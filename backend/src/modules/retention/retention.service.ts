import { Prisma } from '@prisma/client';
import type { DeletionRequest, LegalHold, PrismaClient } from '@prisma/client';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import { AppError } from '../../shared/errors.js';
import { assertExactlyOneRowUpdated, assertNoConcurrentTerminalState, isPrismaUniqueConstraintConflict } from '../../shared/concurrency.js';
import { requirePermission } from '../authz/permissions.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import type {
  ApproveDeletionRequestBody,
  CancelDeletionRequestBody,
  CreateDeletionRequestBody,
  CreateLegalHoldBody,
  DeletionEntityType,
  DeletionRequestListQuery,
  LegalHoldListQuery,
} from './retention.schemas.js';
import {
  ACTIVE_DELETION_REQUEST_STATUSES,
  BACKUP_LIMITATION_DISCLOSURE,
  RETENTION_POLICY_VERSION,
  PASS_56_RETENTION_DELETION_RUNTIME_VERSION,
  assertDeletionApprovalPolicy,
  buildRetentionWorkflowAuditMetadata,
  choosePolicyExecuteAfter,
  isSupportedPurgeTarget,
  purgedStorageReference,
  retentionPolicyDisclosure,
} from './retention-policy.js';

// Pass 18 carry-forward: MIN_PURGE_WAIT_DAYS = 7 is now centralized in retention-policy.ts.

export type RetentionAuditContext = {
  requestId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
};

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function serializeDeletionRequest(row: DeletionRequest) {
  return {
    id: row.id,
    companyId: row.company_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    reason: row.reason,
    requestedByUserId: row.requested_by_user_id,
    approvedByUserId: row.approved_by_user_id,
    cancelledByUserId: row.cancelled_by_user_id,
    status: row.status,
    executeAfter: iso(row.execute_after),
    completedAt: iso(row.completed_at),
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    backupLimitationAcknowledged: row.backup_limitation_acknowledged,
    backupLimitationDisclosure: BACKUP_LIMITATION_DISCLOSURE,
    policyVersion: RETENTION_POLICY_VERSION,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function serializeLegalHold(row: LegalHold) {
  return {
    id: row.id,
    companyId: row.company_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    reason: row.reason,
    placedByUserId: row.placed_by_user_id,
    releasedByUserId: row.released_by_user_id,
    releasedAt: iso(row.released_at),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

type RetentionClient = PrismaClient | Prisma.TransactionClient;

export class RetentionService {
  constructor(private readonly prisma: PrismaClient) {}

  getRetentionPolicy(params: { tenant: TenantContext }) {
    requirePermission(params.tenant, 'retention.read');
    return retentionPolicyDisclosure();
  }

  async listDeletionRequests(params: { tenant: TenantContext; query: DeletionRequestListQuery }) {
    requirePermission(params.tenant, 'retention.read');
    const skip = (params.query.page - 1) * params.query.limit;
    const where: Prisma.DeletionRequestWhereInput = {
      company_id: params.tenant.companyId,
      ...(params.query.status ? { status: params.query.status } : {}),
      ...(params.query.entityType ? { entity_type: params.query.entityType } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.deletionRequest.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip, take: params.query.limit }),
      this.prisma.deletionRequest.count({ where }),
    ]);
    return { items: items.map(serializeDeletionRequest), pagination: { page: params.query.page, limit: params.query.limit, total, totalPages: Math.max(1, Math.ceil(total / params.query.limit)) } };
  }

  async createDeletionRequest(params: { tenant: TenantContext; body: CreateDeletionRequestBody; audit: RetentionAuditContext }) {
    requirePermission(params.tenant, 'retention.manage');
    if (!params.body.backupLimitationAcknowledged) {
      throw new AppError({ statusCode: 422, code: 'BACKUP_LIMITATION_ACK_REQUIRED', message: 'Backup-expiry limitations must be acknowledged before requesting purge.' });
    }
    await this.assertSupportedEntityExists(this.prisma, params.tenant, params.body.entityType, params.body.entityId);
    await this.assertNoActiveLegalHold(this.prisma, params.tenant, params.body.entityType, params.body.entityId);

    const existing = await this.prisma.deletionRequest.findFirst({
      where: {
        company_id: params.tenant.companyId,
        entity_type: params.body.entityType,
        entity_id: params.body.entityId,
        status: { in: [...ACTIVE_DELETION_REQUEST_STATUSES] },
      },
    });
    if (existing) {
      throw new AppError({ statusCode: 409, code: 'DELETION_REQUEST_ALREADY_OPEN', message: 'An open deletion request already exists for this entity.' });
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await this.archiveFirst(tx, params.tenant, params.body.entityType, params.body.entityId);
        const row = await tx.deletionRequest.create({
          data: {
            company_id: params.tenant.companyId,
            entity_type: params.body.entityType,
            entity_id: params.body.entityId,
            reason: params.body.reason,
            requested_by_user_id: params.tenant.userId,
            backup_limitation_acknowledged: true,
          },
        });
        await new AuditLogService(tx).recordEvent({
          tenant: params.tenant,
          sessionId: params.audit.sessionId,
          action: 'DELETION_REQUESTED',
          entityType: 'deletion_request',
          entityId: row.id,
          metadata: buildRetentionWorkflowAuditMetadata({ entityType: row.entity_type, entityId: row.entity_id, stage: 'REQUESTED', extra: { backupLimitationAcknowledged: true } }),
          actorSnapshot: { role: params.tenant.role },
          ipAddress: params.audit.ipAddress,
          userAgent: params.audit.userAgent,
          requestId: params.audit.requestId,
        });
        return row;
      });
      return serializeDeletionRequest(created);
    } catch (error) {
      if (isPrismaUniqueConstraintConflict(error)) {
        throw new AppError({ statusCode: 409, code: 'DELETION_REQUEST_ALREADY_OPEN', message: 'An open deletion request already exists for this entity.' });
      }
      throw error;
    }
  }

  async approveDeletionRequest(params: { tenant: TenantContext; deletionRequestId: string; body: ApproveDeletionRequestBody; audit: RetentionAuditContext }) {
    requirePermission(params.tenant, 'retention.manage');
    const request = await this.getDeletionRequestInTenant(params.tenant, params.deletionRequestId);
    if (request.status !== 'REQUESTED' && request.status !== 'APPROVED') {
      throw new AppError({ statusCode: 409, code: 'INVALID_DELETION_REQUEST_STATE', message: 'Only requested deletion requests may be approved or rescheduled.' });
    }
    await this.assertNoActiveLegalHold(this.prisma, params.tenant, request.entity_type as DeletionEntityType, request.entity_id);
    assertDeletionApprovalPolicy({ tenant: params.tenant, requestedByUserId: request.requested_by_user_id });

    const now = new Date();
    const requestedExecuteAfter = params.body.executeAfter ? new Date(params.body.executeAfter) : null;
    const executeAfter = choosePolicyExecuteAfter(requestedExecuteAfter, now);

    const updated = await this.prisma.$transaction(async (tx) => {
      assertNoConcurrentTerminalState({
        count: (await tx.deletionRequest.updateMany({
          where: { id: request.id, company_id: params.tenant.companyId, status: { in: ['REQUESTED', 'APPROVED'] } },
          data: { status: 'SCHEDULED', approved_by_user_id: params.tenant.userId, execute_after: executeAfter },
        })).count,
        entity: 'Deletion request',
        id: request.id,
        expectedState: 'REQUESTED_OR_APPROVED',
      });
      const row = await tx.deletionRequest.findUniqueOrThrow({ where: { id: request.id } });
      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'DELETION_APPROVED',
        entityType: 'deletion_request',
        entityId: row.id,
        metadata: buildRetentionWorkflowAuditMetadata({ entityType: row.entity_type, entityId: row.entity_id, stage: 'APPROVED', extra: { executeAfter: executeAfter.toISOString(), requesterMayApproveOwnRequest: false } }),
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });
      return row;
    });
    return serializeDeletionRequest(updated);
  }

  async cancelDeletionRequest(params: { tenant: TenantContext; deletionRequestId: string; body: CancelDeletionRequestBody; audit: RetentionAuditContext }) {
    requirePermission(params.tenant, 'retention.manage');
    const request = await this.getDeletionRequestInTenant(params.tenant, params.deletionRequestId);
    if (request.status === 'COMPLETED' || request.status === 'RUNNING') {
      throw new AppError({ statusCode: 409, code: 'INVALID_DELETION_REQUEST_STATE', message: 'Running or completed deletion requests cannot be cancelled.' });
    }
    if (request.status === 'CANCELLED') return serializeDeletionRequest(request);

    const updated = await this.prisma.$transaction(async (tx) => {
      assertNoConcurrentTerminalState({
        count: (await tx.deletionRequest.updateMany({
          where: { id: request.id, company_id: params.tenant.companyId, status: request.status },
          data: { status: 'CANCELLED', cancelled_by_user_id: params.tenant.userId },
        })).count,
        entity: 'Deletion request',
        id: request.id,
        expectedState: request.status,
      });
      const row = await tx.deletionRequest.findUniqueOrThrow({ where: { id: request.id } });
      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'DELETION_CANCELLED',
        entityType: 'deletion_request',
        entityId: row.id,
        metadata: buildRetentionWorkflowAuditMetadata({ entityType: row.entity_type, entityId: row.entity_id, stage: 'CANCELLED', extra: { reason: params.body.reason } }),
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });
      return row;
    });
    return serializeDeletionRequest(updated);
  }

  async runDueDeletionRequests(params: { tenant: TenantContext; audit: RetentionAuditContext; asOf?: Date }) {
    requirePermission(params.tenant, 'jobs.manage');
    return this.runDueDeletionRequestsForCompany({ companyId: params.tenant.companyId, asOf: params.asOf, audit: params.audit, actorTenant: params.tenant });
  }

  async runDueDeletionRequestsForCompany(params: { companyId?: string; audit: RetentionAuditContext; asOf?: Date; actorTenant?: TenantContext }) {
    const asOf = params.asOf ?? new Date();
    const due = await this.prisma.deletionRequest.findMany({
      where: { ...(params.companyId ? { company_id: params.companyId } : {}), status: 'SCHEDULED', execute_after: { lte: asOf } },
      orderBy: [{ execute_after: 'asc' }, { id: 'asc' }],
      take: 25,
    });
    const results = [];
    for (const request of due) {
      const actorTenant = params.actorTenant && params.actorTenant.companyId === request.company_id
        ? params.actorTenant
        : this.buildRetentionWorkerTenant(request);
      results.push(await this.executeDeletionRequest(actorTenant, request.id, params.audit));
    }
    return { processed: results.length, items: results, policyVersion: RETENTION_POLICY_VERSION, runtimeVersion: PASS_56_RETENTION_DELETION_RUNTIME_VERSION, backupLimitationDisclosure: BACKUP_LIMITATION_DISCLOSURE };
  }

  async listLegalHolds(params: { tenant: TenantContext; query: LegalHoldListQuery }) {
    requirePermission(params.tenant, 'retention.read');
    const skip = (params.query.page - 1) * params.query.limit;
    const where: Prisma.LegalHoldWhereInput = {
      company_id: params.tenant.companyId,
      ...(params.query.includeReleased ? {} : { released_at: null }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.legalHold.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip, take: params.query.limit }),
      this.prisma.legalHold.count({ where }),
    ]);
    return { items: items.map(serializeLegalHold), pagination: { page: params.query.page, limit: params.query.limit, total, totalPages: Math.max(1, Math.ceil(total / params.query.limit)) } };
  }

  async createLegalHold(params: { tenant: TenantContext; body: CreateLegalHoldBody; audit: RetentionAuditContext }) {
    requirePermission(params.tenant, 'retention.manage');
    if (params.body.entityType && params.body.entityId) {
      await this.assertSupportedEntityExists(this.prisma, params.tenant, params.body.entityType, params.body.entityId);
    }
    const existingActiveHold = await this.prisma.legalHold.findFirst({
      where: {
        company_id: params.tenant.companyId,
        entity_type: params.body.entityType ?? null,
        entity_id: params.body.entityId ?? null,
        released_at: null,
      },
    });
    if (existingActiveHold) {
      throw new AppError({ statusCode: 409, code: 'LEGAL_HOLD_ALREADY_ACTIVE', message: 'An active legal hold already exists for this scope.' });
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const hold = await tx.legalHold.create({
        data: {
          company_id: params.tenant.companyId,
          entity_type: params.body.entityType,
          entity_id: params.body.entityId,
          reason: params.body.reason,
          placed_by_user_id: params.tenant.userId,
        },
      });
      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'LEGAL_HOLD_PLACED',
        entityType: 'legal_hold',
        entityId: hold.id,
        metadata: buildRetentionWorkflowAuditMetadata({ entityType: hold.entity_type ?? 'COMPANY', entityId: hold.entity_id ?? params.tenant.companyId, stage: 'LEGAL_HOLD_PLACED' }),
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });
      return hold;
    });
    return serializeLegalHold(created);
  }

  async releaseLegalHold(params: { tenant: TenantContext; legalHoldId: string; audit: RetentionAuditContext }) {
    requirePermission(params.tenant, 'retention.manage');
    const hold = await this.prisma.legalHold.findFirst({ where: { id: params.legalHoldId, company_id: params.tenant.companyId } });
    if (!hold) throw new AppError({ statusCode: 404, code: 'LEGAL_HOLD_NOT_FOUND', message: 'Legal hold was not found.' });
    if (hold.released_at) return serializeLegalHold(hold);

    const released = await this.prisma.$transaction(async (tx) => {
      assertExactlyOneRowUpdated(
        await tx.legalHold.updateMany({ where: { id: hold.id, company_id: params.tenant.companyId, released_at: null }, data: { released_at: new Date(), released_by_user_id: params.tenant.userId } }),
        'Legal hold was concurrently released before this request could be committed.',
        [{ field: 'expectedReleasedAt', reason: 'null' }],
      );
      const row = await tx.legalHold.findUniqueOrThrow({ where: { id: hold.id } });
      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'LEGAL_HOLD_RELEASED',
        entityType: 'legal_hold',
        entityId: row.id,
        metadata: buildRetentionWorkflowAuditMetadata({ entityType: row.entity_type ?? 'COMPANY', entityId: row.entity_id ?? params.tenant.companyId, stage: 'LEGAL_HOLD_RELEASED' }),
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });
      return row;
    });
    return serializeLegalHold(released);
  }

  private async executeDeletionRequest(tenant: TenantContext, deletionRequestId: string, audit: RetentionAuditContext) {
    const request = await this.getDeletionRequestInTenant(tenant, deletionRequestId);
    if (request.status !== 'SCHEDULED') return serializeDeletionRequest(request);
    await this.assertNoActiveLegalHold(this.prisma, tenant, request.entity_type as DeletionEntityType, request.entity_id);

    const completed = await this.prisma.$transaction(async (tx) => {
      assertNoConcurrentTerminalState({
        count: (await tx.deletionRequest.updateMany({ where: { id: request.id, company_id: tenant.companyId, status: 'SCHEDULED' }, data: { status: 'RUNNING' } })).count,
        entity: 'Deletion request',
        id: request.id,
        expectedState: 'SCHEDULED',
      });
      const running = await tx.deletionRequest.findUniqueOrThrow({ where: { id: request.id } });
      await this.assertNoActiveLegalHold(tx, tenant, running.entity_type as DeletionEntityType, running.entity_id);
      await this.purgeEntity(tx, tenant, running.entity_type as DeletionEntityType, running.entity_id);
      assertExactlyOneRowUpdated(
        await tx.deletionRequest.updateMany({ where: { id: request.id, company_id: tenant.companyId, status: 'RUNNING' }, data: { status: 'COMPLETED', completed_at: new Date() } }),
        'Deletion request changed before completion could be committed.',
        [{ field: 'expectedStatus', reason: 'RUNNING' }],
      );
      const row = await tx.deletionRequest.findUniqueOrThrow({ where: { id: request.id } });
      await new AuditLogService(tx).recordEvent({
        tenant,
        sessionId: audit.sessionId,
        action: 'DELETION_COMPLETED',
        entityType: 'deletion_request',
        entityId: row.id,
        metadata: buildRetentionWorkflowAuditMetadata({ entityType: row.entity_type, entityId: row.entity_id, stage: 'COMPLETED', extra: { executedBy: 'retention-purge-worker' } }),
        actorSnapshot: { role: tenant.role },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
        requestId: audit.requestId,
      });
      return row;
    });
    return serializeDeletionRequest(completed);
  }

  private buildRetentionWorkerTenant(request: DeletionRequest): TenantContext {
    return {
      companyId: request.company_id,
      userId: request.approved_by_user_id ?? request.requested_by_user_id,
      membershipId: 'retention-purge-worker',
      role: 'OWNER',
    };
  }

  private async getDeletionRequestInTenant(tenant: TenantContext, deletionRequestId: string) {
    const request = await this.prisma.deletionRequest.findFirst({ where: { id: deletionRequestId, company_id: tenant.companyId } });
    if (!request) throw new AppError({ statusCode: 404, code: 'DELETION_REQUEST_NOT_FOUND', message: 'Deletion request was not found.' });
    return request;
  }

  private async assertNoActiveLegalHold(client: RetentionClient, tenant: TenantContext, entityType: DeletionEntityType, entityId: string) {
    const hold = await client.legalHold.findFirst({
      where: {
        company_id: tenant.companyId,
        released_at: null,
        OR: [
          { entity_type: null, entity_id: null },
          { entity_type: entityType, entity_id: entityId },
        ],
      },
    });
    if (hold) throw new AppError({ statusCode: 409, code: 'LEGAL_HOLD_ACTIVE', message: 'A legal hold prevents purge for this entity.' });
  }

  private async assertSupportedEntityExists(client: RetentionClient, tenant: TenantContext, entityType: DeletionEntityType, entityId: string) {
    if (entityType === 'EVIDENCE_ITEM') {
      const exists = await client.evidenceItem.findFirst({ where: { id: entityId, company_id: tenant.companyId } });
      if (!exists) throw new AppError({ statusCode: 404, code: 'RETENTION_ENTITY_NOT_FOUND', message: 'Evidence item was not found.' });
      return;
    }
    if (entityType === 'REPORT') {
      const exists = await client.report.findFirst({ where: { id: entityId, company_id: tenant.companyId } });
      if (!exists) throw new AppError({ statusCode: 404, code: 'RETENTION_ENTITY_NOT_FOUND', message: 'Report was not found.' });
      return;
    }
    if (!isSupportedPurgeTarget(entityType)) {
      throw new AppError({ statusCode: 422, code: 'UNSUPPORTED_PURGE_TARGET', message: 'This entity type is not a supported purge target.' });
    }
    const exists = await client.aiAnalysis.findFirst({ where: { id: entityId, company_id: tenant.companyId } });
    if (!exists) throw new AppError({ statusCode: 404, code: 'RETENTION_ENTITY_NOT_FOUND', message: 'AI analysis was not found.' });
  }

  private async archiveFirst(client: RetentionClient, tenant: TenantContext, entityType: DeletionEntityType, entityId: string) {
    if (entityType === 'EVIDENCE_ITEM') {
      await client.evidenceItem.updateMany({ where: { id: entityId, company_id: tenant.companyId, archived_at: null }, data: { archived_at: new Date() } });
    }
    if (entityType === 'REPORT') {
      await client.report.updateMany({ where: { id: entityId, company_id: tenant.companyId, status: { not: 'EXPIRED' } }, data: { status: 'EXPIRED', expires_at: new Date() } });
    }
    if (entityType === 'AI_ANALYSIS') {
      await client.aiAnalysis.updateMany({ where: { id: entityId, company_id: tenant.companyId }, data: { summary: '[archived pending approved deletion request]' } });
    }
  }

  private async purgeEntity(client: RetentionClient, tenant: TenantContext, entityType: DeletionEntityType, entityId: string) {
    if (entityType === 'EVIDENCE_ITEM') {
      const versions = await client.evidenceVersion.findMany({ where: { evidence_item_id: entityId, evidence_item: { company_id: tenant.companyId } }, select: { id: true } });
      await client.evidenceItem.update({ where: { id: entityId }, data: { title: '[purged evidence item]', description: null, archived_at: new Date(), latest_version_id: null, current_approved_version_id: null } });
      for (const version of versions) {
        await client.evidenceVersion.update({
          where: { id: version.id },
          data: { storage_key: purgedStorageReference(version.id), file_name: '[purged]', extracted_text: null, status: 'ARCHIVED', object_finalized_at: null, storage_reconciliation_required: false, quarantine_reason: 'Purged through approved deletion request.' },
        });
      }
      return;
    }
    if (entityType === 'REPORT') {
      await client.report.update({ where: { id: entityId }, data: { status: 'EXPIRED', storage_key: null, content_json: Prisma.JsonNull, content_text: null, content_type: null, file_name: null, error_code: null, expires_at: new Date() } });
      return;
    }
    await client.aiAnalysis.update({ where: { id: entityId }, data: { structured_result_json: {}, summary: null, error_message: null, token_usage_json: {}, status: 'COMPLETED', model_name: '[purged]', provider: '[purged]' } });
  }
}
