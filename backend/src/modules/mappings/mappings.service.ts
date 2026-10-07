import type { PrismaClient } from '@prisma/client';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import { AppError } from '../../shared/errors.js';
import { assertNoConcurrentTerminalState } from '../../shared/concurrency.js';
import { requirePermission } from '../authz/permissions.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { ApproveMappingBody, CreateManualMappingBody, MappingListQuery, RejectMappingBody } from './mapping.schemas.js';
import { assertManualMappingCanBeCreated, assertMappingCanBeApproved, assertMappingCanBeRejected } from './mapping-policy.js';
import { MappingsRepository } from './mappings.repository.js';

export type MappingAuditContext = {
  requestId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export class MappingsService {
  constructor(private readonly prisma: PrismaClient) {}

  async listMappingsForEvidenceVersion(params: { tenant: TenantContext; versionId: string; query: MappingListQuery }) {
    requirePermission(params.tenant, 'evidence.read');
    const repo = new MappingsRepository(this.prisma);
    const evidence = await repo.findEvidenceVersionInTenantScope({ tenant: params.tenant, versionId: params.versionId });
    if (!evidence) {
      throw new AppError({ statusCode: 404, code: 'EVIDENCE_VERSION_NOT_FOUND', message: 'Evidence version was not found.' });
    }
    return repo.listMappingsForEvidenceVersion(params);
  }

  async createManualMapping(params: {
    tenant: TenantContext;
    versionId: string;
    body: CreateManualMappingBody;
    audit: MappingAuditContext;
  }) {
    requirePermission(params.tenant, 'mapping.create');

    return this.prisma.$transaction(async (tx) => {
      const repo = new MappingsRepository(tx);
      const evidence = await repo.findEvidenceVersionInTenantScope({ tenant: params.tenant, versionId: params.versionId });
      if (!evidence) {
        throw new AppError({ statusCode: 404, code: 'EVIDENCE_VERSION_NOT_FOUND', message: 'Evidence version was not found.' });
      }

      const control = await repo.findControlInActiveTenantEnrollment({ tenant: params.tenant, controlId: params.body.controlId });
      const requirement = await repo.findRequirementForControl({ controlId: params.body.controlId, requirementId: params.body.requirementId });

      assertManualMappingCanBeCreated({
        evidenceStatus: evidence.status,
        controlIsTenantEnrolled: Boolean(control),
        requirementBelongsToControl: Boolean(requirement),
      });

      const duplicateOpen = await repo.findOpenMappingForVersionRequirement({
        evidenceVersionId: evidence.id,
        requirementId: params.body.requirementId,
      });
      if (duplicateOpen) {
        throw new AppError({
          statusCode: 409,
          code: 'DUPLICATE_ACTIVE_MAPPING',
          message: 'A suggested, pending, or approved mapping already exists for this evidence version and requirement.',
          details: [{ field: 'requirementId', reason: duplicateOpen.status }],
        });
      }

      const mapping = await tx.evidenceControlMapping.create({
        data: {
          company_id: params.tenant.companyId,
          evidence_version_id: evidence.id,
          control_id: params.body.controlId,
          requirement_id: params.body.requirementId,
          source: 'MANUAL',
          status: 'PENDING_REVIEW',
          reason: params.body.reason?.trim(),
          mapped_by_user_id: params.tenant.userId,
        },
        include: {
          control: { select: { id: true, code: true, title: true } },
          requirement: { select: { id: true, code: true, name: true } },
        },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'MAPPING_CREATED',
        entityType: 'evidence_control_mapping',
        entityId: mapping.id,
        metadata: {
          evidenceVersionId: evidence.id,
          evidenceItemId: evidence.evidence_item_id,
          controlId: mapping.control_id,
          controlCode: mapping.control.code,
          requirementId: mapping.requirement_id,
          requirementCode: mapping.requirement?.code,
          source: mapping.source,
          status: mapping.status,
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });

      return mapping;
    });
  }

  async approveMapping(params: { tenant: TenantContext; mappingId: string; body: ApproveMappingBody; audit: MappingAuditContext }) {
    requirePermission(params.tenant, 'mapping.review');

    return this.prisma.$transaction(async (tx) => {
      const repo = new MappingsRepository(tx);
      const mapping = await repo.findMappingInTenantScope({ tenant: params.tenant, mappingId: params.mappingId });
      if (!mapping) {
        throw new AppError({ statusCode: 404, code: 'MAPPING_NOT_FOUND', message: 'Mapping was not found.' });
      }

      if (mapping.evidence_version.status === 'SECURITY_REJECTED' || mapping.evidence_version.status === 'ARCHIVED') {
        throw new AppError({
          statusCode: 409,
          code: 'EVIDENCE_NOT_MAPPABLE',
          message: 'Security-rejected or archived evidence cannot have approved mappings.',
          details: [{ field: 'evidenceVersion.status', reason: mapping.evidence_version.status }],
        });
      }

      const duplicateApproved = mapping.requirement_id
        ? await repo.findApprovedMappingForVersionRequirement({
            evidenceVersionId: mapping.evidence_version_id,
            requirementId: mapping.requirement_id,
            excludeMappingId: mapping.id,
          })
        : null;

      assertMappingCanBeApproved({ status: mapping.status, duplicateApprovedExists: Boolean(duplicateApproved) });

      assertNoConcurrentTerminalState({
        count: (await tx.evidenceControlMapping.updateMany({
          where: { id: mapping.id, company_id: params.tenant.companyId, status: mapping.status },
          data: {
            status: 'APPROVED',
            reviewed_by_user_id: params.tenant.userId,
            reviewed_at: new Date(),
            reason: params.body.reviewNote?.trim() ?? mapping.reason,
            rejection_reason: null,
          },
        })).count,
        entity: 'Evidence mapping',
        id: mapping.id,
        expectedState: mapping.status,
      });
      const updated = await tx.evidenceControlMapping.findUniqueOrThrow({
        where: { id: mapping.id },
        include: {
          control: { select: { id: true, code: true, title: true } },
          requirement: { select: { id: true, code: true, name: true } },
        },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'MAPPING_APPROVED',
        entityType: 'evidence_control_mapping',
        entityId: updated.id,
        metadata: {
          beforeStatus: mapping.status,
          afterStatus: updated.status,
          evidenceVersionId: updated.evidence_version_id,
          controlCode: updated.control.code,
          requirementCode: updated.requirement?.code,
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });

      return updated;
    });
  }

  async rejectMapping(params: { tenant: TenantContext; mappingId: string; body: RejectMappingBody; audit: MappingAuditContext }) {
    requirePermission(params.tenant, 'mapping.review');

    return this.prisma.$transaction(async (tx) => {
      const repo = new MappingsRepository(tx);
      const mapping = await repo.findMappingInTenantScope({ tenant: params.tenant, mappingId: params.mappingId });
      if (!mapping) {
        throw new AppError({ statusCode: 404, code: 'MAPPING_NOT_FOUND', message: 'Mapping was not found.' });
      }

      assertMappingCanBeRejected(mapping.status);

      assertNoConcurrentTerminalState({
        count: (await tx.evidenceControlMapping.updateMany({
          where: { id: mapping.id, company_id: params.tenant.companyId, status: mapping.status },
          data: {
            status: 'REJECTED',
            rejection_reason: params.body.reason.trim(),
            reviewed_by_user_id: params.tenant.userId,
            reviewed_at: new Date(),
            reason: params.body.reviewNote?.trim() ?? mapping.reason,
          },
        })).count,
        entity: 'Evidence mapping',
        id: mapping.id,
        expectedState: mapping.status,
      });
      const updated = await tx.evidenceControlMapping.findUniqueOrThrow({
        where: { id: mapping.id },
        include: {
          control: { select: { id: true, code: true, title: true } },
          requirement: { select: { id: true, code: true, name: true } },
        },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'MAPPING_REJECTED',
        entityType: 'evidence_control_mapping',
        entityId: updated.id,
        metadata: {
          beforeStatus: mapping.status,
          afterStatus: updated.status,
          evidenceVersionId: updated.evidence_version_id,
          controlCode: updated.control.code,
          requirementCode: updated.requirement?.code,
          reason: updated.rejection_reason,
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });

      return updated;
    });
  }
}
