import type { PrismaClient } from '@prisma/client';
import type { AppEnv } from '../../config/env.js';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import { AuditorAccessService } from '../auditor-access/auditor-access.service.js';
import { AppError } from '../../shared/errors.js';
import { assertExactlyOneRowUpdated, assertNoConcurrentTerminalState, isPrismaUniqueConstraintConflict, normalizeIdempotencyKey } from '../../shared/concurrency.js';
import { requirePermission } from '../authz/permissions.js';
import { createPrivateObjectStorage } from '../storage/storage.factory.js';
import type { PrivateObjectStorage } from '../storage/storage.types.js';
import { assertProductionCustomerEvidenceGateOpen } from '../../shared/production-gate.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import { EvidenceRepository } from './evidence.repository.js';
import type { EvidenceApproveBody, EvidenceArchiveBody, EvidenceListQuery, EvidenceRejectBody, UploadMetadata } from './evidence.schemas.js';
import { assertAllowedUpload, assertEvidenceDownloadSecurityClearance, deriveTitleFromUpload, makeEvidenceObjectKey, sanitizeDisplayFilename, sha256Hex } from './evidence-upload-policy.js';
import { decideInitialSecurityScan } from './security-scan-policy.js';
import { assertEvidenceCanBeApproved, assertEvidenceCanBeRejected, assertValidityRange } from './evidence-review-policy.js';
import { assertUploadChecksum, assertUploadIntentTransition, finalEvidenceStatusAfterObjectFinalization, uploadFailureCode } from './upload-finalization-policy.js';

export type EvidenceUploadFile = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

export type RequestAuditContext = {
  requestId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
};

function safeDownloadFilename(name: string): string {
  return sanitizeDisplayFilename(name).replace(/"/g, '');
}

export class EvidenceService {
  private readonly storage: PrivateObjectStorage;

  constructor(private readonly prisma: PrismaClient, private readonly env: AppEnv, storage?: PrivateObjectStorage) {
    this.storage = storage ?? createPrivateObjectStorage(env);
  }

  async listEvidence(tenant: TenantContext, query: EvidenceListQuery) {
    requirePermission(tenant, 'evidence.read');
    const allowedEvidenceItemIds = await new AuditorAccessService(this.prisma).getAccessibleEvidenceItemIdsForAuditor(tenant);
    return new EvidenceRepository(this.prisma).listEvidenceInTenantScope(tenant, query, allowedEvidenceItemIds);
  }

  async getEvidenceDetail(tenant: TenantContext, evidenceItemId: string) {
    requirePermission(tenant, 'evidence.read');
    const evidence = await new EvidenceRepository(this.prisma).findEvidenceItemInTenantScope({ tenant, evidenceItemId });
    if (!evidence) {
      throw new AppError({ statusCode: 404, code: 'EVIDENCE_NOT_FOUND', message: 'Evidence was not found.' });
    }
    await new AuditorAccessService(this.prisma).assertAuditorCanAccessEvidenceItem({ tenant, evidenceItemId });
    return evidence;
  }

  async listVersions(tenant: TenantContext, evidenceItemId: string) {
    requirePermission(tenant, 'evidence.read');
    const evidence = await new EvidenceRepository(this.prisma).findEvidenceItemInTenantScope({ tenant, evidenceItemId });
    if (!evidence) {
      throw new AppError({ statusCode: 404, code: 'EVIDENCE_NOT_FOUND', message: 'Evidence was not found.' });
    }
    await new AuditorAccessService(this.prisma).assertAuditorCanAccessEvidenceItem({ tenant, evidenceItemId });
    return evidence.versions;
  }

  async uploadNewEvidence(params: {
    tenant: TenantContext;
    file: EvidenceUploadFile;
    metadata: UploadMetadata;
    idempotencyKey?: string;
    audit: RequestAuditContext;
  }) {
    requirePermission(params.tenant, 'evidence.upload');
    return this.finalizeUpload({ ...params, evidenceItemId: undefined });
  }

  async uploadNewVersion(params: {
    tenant: TenantContext;
    evidenceItemId: string;
    file: EvidenceUploadFile;
    metadata: UploadMetadata;
    idempotencyKey?: string;
    audit: RequestAuditContext;
  }) {
    requirePermission(params.tenant, 'evidence.upload');

    const existing = await new EvidenceRepository(this.prisma).findEvidenceItemInTenantScope({
      tenant: params.tenant,
      evidenceItemId: params.evidenceItemId,
    });
    if (!existing || existing.archived_at) {
      throw new AppError({ statusCode: 404, code: 'EVIDENCE_NOT_FOUND', message: 'Evidence was not found.' });
    }

    return this.finalizeUpload(params);
  }

  private async finalizeUpload(params: {
    tenant: TenantContext;
    evidenceItemId?: string;
    file: EvidenceUploadFile;
    metadata: UploadMetadata;
    idempotencyKey?: string;
    audit: RequestAuditContext;
  }) {
    assertProductionCustomerEvidenceGateOpen(this.env);

    const fileName = sanitizeDisplayFilename(params.file.fileName);
    assertAllowedUpload({ fileName, mimeType: params.file.mimeType, buffer: params.file.buffer, maxBytes: this.env.MAX_UPLOAD_BYTES });

    const idempotencyKey = normalizeIdempotencyKey(params.idempotencyKey);
    const checksum = sha256Hex(params.file.buffer);
    const temporaryStorageKey = makeEvidenceObjectKey({ companyId: params.tenant.companyId, evidenceItemId: params.evidenceItemId, fileName, temporary: true });
    const baseFinalStorageKey = makeEvidenceObjectKey({ companyId: params.tenant.companyId, evidenceItemId: params.evidenceItemId, fileName, temporary: false });
    const expiresAt = new Date(Date.now() + this.env.UPLOAD_INTENT_TTL_SECONDS * 1000);

    if (idempotencyKey) {
      const replay = await this.prisma.uploadIntent.findUnique({
        where: { company_id_idempotency_key: { company_id: params.tenant.companyId, idempotency_key: idempotencyKey } },
        include: { evidence_item: { include: { latest_version: true, current_approved_version: true } } },
      });
      if (replay?.status === 'FINALIZED' && replay.evidence_item) {
        return replay.evidence_item;
      }
      if (replay) {
        throw new AppError({
          statusCode: 409,
          code: 'UPLOAD_IDEMPOTENCY_CONFLICT',
          message: 'An upload with this Idempotency-Key is already in progress or failed for this company.',
        });
      }
    }

    let uploadIntent;
    try {
      uploadIntent = await this.prisma.uploadIntent.create({
        data: {
          company_id: params.tenant.companyId,
          evidence_item_id: params.evidenceItemId,
          idempotency_key: idempotencyKey,
          temporary_storage_key: temporaryStorageKey,
          final_storage_key: baseFinalStorageKey,
          original_file_name: fileName,
          mime_type: params.file.mimeType,
          expected_sha256: checksum,
          status: 'CREATED',
          expires_at: expiresAt,
          created_by_user_id: params.tenant.userId,
        },
      });
    } catch (error) {
      if (idempotencyKey && isPrismaUniqueConstraintConflict(error)) {
        const replay = await this.prisma.uploadIntent.findUnique({
          where: { company_id_idempotency_key: { company_id: params.tenant.companyId, idempotency_key: idempotencyKey } },
          include: { evidence_item: { include: { latest_version: true, current_approved_version: true } } },
        });
        if (replay?.status === 'FINALIZED' && replay.evidence_item) return replay.evidence_item;
        throw new AppError({ statusCode: 409, code: 'UPLOAD_IDEMPOTENCY_CONFLICT', message: 'An upload with this Idempotency-Key is already in progress or failed for this company.' });
      }
      throw error;
    }

    let temporaryObjectWritten = false;
    let finalizationReached = false;
    let finalObjectMoved = false;
    let evidenceVersionId: string | undefined;

    try {
      assertUploadIntentTransition('CREATED', 'UPLOADED');
      await this.storage.writeBuffer(temporaryStorageKey, params.file.buffer, {
        size: params.file.buffer.length,
        contentType: params.file.mimeType,
        checksumSha256: checksum,
      });
      temporaryObjectWritten = true;
      assertExactlyOneRowUpdated(
        await this.prisma.uploadIntent.updateMany({ where: { id: uploadIntent.id, status: 'CREATED' }, data: { status: 'UPLOADED', uploaded_at: new Date() } }),
        'Upload intent was concurrently changed before the temporary object write could be recorded.',
        [{ field: 'expectedStatus', reason: 'CREATED' }],
      );

      assertUploadIntentTransition('UPLOADED', 'VALIDATING');
      assertExactlyOneRowUpdated(
        await this.prisma.uploadIntent.updateMany({ where: { id: uploadIntent.id, status: 'UPLOADED' }, data: { status: 'VALIDATING', validating_at: new Date() } }),
        'Upload intent was concurrently changed before validation could begin.',
        [{ field: 'expectedStatus', reason: 'UPLOADED' }],
      );
      assertUploadChecksum({ expectedSha256: checksum, actualSha256: sha256Hex(params.file.buffer) });

      const scanDecision = await decideInitialSecurityScan({
        env: this.env,
        buffer: params.file.buffer,
        fileName,
        mimeType: params.file.mimeType,
        sha256Checksum: checksum,
      });

      const finalStorageKey = ['QUARANTINED', 'SECURITY_REJECTED'].includes(scanDecision.evidenceStatus)
        ? baseFinalStorageKey.replace('/evidence/', '/quarantine/')
        : baseFinalStorageKey;

      let evidenceItemId = params.evidenceItemId;
      const created = await this.prisma.$transaction(async (tx) => {
        const transitioned = await tx.uploadIntent.updateMany({
          where: { id: uploadIntent.id, status: 'VALIDATING' },
          data: { status: 'FINALIZING', finalizing_at: new Date(), final_storage_key: finalStorageKey },
        });
        if (transitioned.count !== 1) {
          throw new AppError({ statusCode: 409, code: 'UPLOAD_INTENT_CONCURRENTLY_MODIFIED', message: 'Upload intent changed before finalization could begin.' });
        }
        finalizationReached = true;

        const item = evidenceItemId
          ? await tx.evidenceItem.findFirst({ where: { id: evidenceItemId, company_id: params.tenant.companyId, archived_at: null } })
          : await tx.evidenceItem.create({
              data: {
                company_id: params.tenant.companyId,
                title: deriveTitleFromUpload({ title: params.metadata.title, fileName }),
                description: params.metadata.description,
                sensitivity_level: params.metadata.sensitivityLevel,
                created_by_user_id: params.tenant.userId,
              },
            });

        if (!item) {
          throw new AppError({ statusCode: 404, code: 'EVIDENCE_NOT_FOUND', message: 'Evidence was not found.' });
        }
        evidenceItemId = item.id;

        const nextVersionNo = evidenceItemId === params.evidenceItemId
          ? await new EvidenceRepository(tx).nextVersionNumber(evidenceItemId)
          : 1;

        const version = await tx.evidenceVersion.create({
          data: {
            evidence_item_id: item.id,
            version_no: nextVersionNo,
            storage_key: finalStorageKey,
            file_name: fileName,
            mime_type: params.file.mimeType,
            file_size: params.file.buffer.length,
            sha256_checksum: checksum,
            status: scanDecision.evidenceStatus,
            security_scan_status: scanDecision.status,
            security_scan_completed_at: scanDecision.completedAt,
            quarantine_reason: scanDecision.quarantineReason,
            storage_reconciliation_required: false,
            storage_reconciliation_status: 'NOT_REQUIRED',
            uploaded_by_user_id: params.tenant.userId,
          },
        });
        evidenceVersionId = version.id;

        await tx.uploadIntent.update({
          where: { id: uploadIntent.id },
          data: { evidence_item_id: item.id, evidence_version_id: version.id },
        });

        return { item, version };
      });

      try {
        await this.storage.moveObject(temporaryStorageKey, finalStorageKey, {
          size: params.file.buffer.length,
          contentType: params.file.mimeType,
          checksumSha256: checksum,
          finalizedAt: new Date(),
        });
        finalObjectMoved = true;
      } catch (error) {
        await this.prisma.$transaction(async (tx) => {
          await tx.evidenceVersion.update({
            where: { id: created.version.id },
            data: {
              status: 'PROCESSING_FAILED',
              storage_reconciliation_required: true,
              storage_reconciliation_status: 'REQUIRED',
              storage_reconciliation_last_error: error instanceof Error ? error.message.slice(0, 1000) : 'Final object operation failed.',
            },
          });
          await tx.uploadIntent.update({
            where: { id: uploadIntent.id },
            data: { status: 'FAILED', failed_at: new Date(), failure_code: 'FINAL_OBJECT_OPERATION_FAILED' },
          });
        });
        throw new AppError({
          statusCode: 409,
          code: 'UPLOAD_FINAL_OBJECT_OPERATION_FAILED',
          message: 'Evidence metadata was created but the object could not be finalized; storage reconciliation is required.',
        });
      }

      const finalStatus = finalEvidenceStatusAfterObjectFinalization(scanDecision.evidenceStatus);
      const result = await this.prisma.$transaction(async (tx) => {
        assertExactlyOneRowUpdated(
          await tx.evidenceVersion.updateMany({
            where: { id: created.version.id, status: created.version.status, object_finalized_at: null },
            data: {
              object_finalized_at: new Date(),
              status: finalStatus,
              storage_reconciliation_required: false,
              storage_reconciliation_status: 'NOT_REQUIRED',
              storage_reconciliation_last_error: null,
            },
          }),
          'Evidence version was concurrently finalized or changed before upload completion.',
          [{ field: 'expectedStatus', reason: created.version.status }],
        );
        const version = await tx.evidenceVersion.findUniqueOrThrow({ where: { id: created.version.id } });

        assertExactlyOneRowUpdated(
          await tx.evidenceItem.updateMany({
            where: { id: created.item.id, company_id: params.tenant.companyId, latest_version_id: created.item.latest_version_id },
            data: { latest_version_id: version.id },
          }),
          'Evidence item latest-version pointer changed before upload completion.',
          [{ field: 'expectedLatestVersionId', reason: created.item.latest_version_id ?? 'null' }],
        );

        await tx.uploadIntent.update({
          where: { id: uploadIntent.id },
          data: { status: 'FINALIZED', finalized_at: new Date(), temp_deleted_at: new Date(), evidence_item_id: created.item.id, evidence_version_id: version.id },
        });

        await new AuditLogService(tx).recordEvent({
          tenant: params.tenant,
          sessionId: params.audit.sessionId,
          action: finalStatus === 'SECURITY_REJECTED' ? 'EVIDENCE_SECURITY_REJECTED' : finalStatus === 'QUARANTINED' ? 'EVIDENCE_QUARANTINED' : 'EVIDENCE_UPLOADED',
          entityType: 'evidence_version',
          entityId: version.id,
          metadata: {
            evidenceItemId: created.item.id,
            versionNo: version.version_no,
            fileName: version.file_name,
            mimeType: version.mime_type,
            fileSize: version.file_size,
            sha256Checksum: version.sha256_checksum,
            status: version.status,
            securityScanStatus: version.security_scan_status,
            securityScanProvider: scanDecision.provider,
            securityScanSignature: scanDecision.signature,
            securityScanBypassed: scanDecision.bypassed === true,
            quarantineReason: scanDecision.quarantineReason,
            uploadIntentId: uploadIntent.id,
            temporaryObjectFinalized: true,
          },
          actorSnapshot: { role: params.tenant.role },
          ipAddress: params.audit.ipAddress,
          userAgent: params.audit.userAgent,
          requestId: params.audit.requestId,
        });

        return tx.evidenceItem.findUniqueOrThrow({
          where: { id: created.item.id },
          include: { latest_version: true, current_approved_version: true },
        });
      });

      return result;
    } catch (error) {
      const failureCode = uploadFailureCode(error);
      if (temporaryObjectWritten && !finalizationReached) {
        await this.storage.deleteObject(temporaryStorageKey).catch(() => undefined);
        await this.prisma.uploadIntent.update({
          where: { id: uploadIntent.id },
          data: { status: 'FAILED', failed_at: new Date(), temp_deleted_at: new Date(), failure_code: failureCode },
        }).catch(() => undefined);
      } else if (evidenceVersionId && (finalizationReached || finalObjectMoved)) {
        await this.prisma.evidenceVersion.update({
          where: { id: evidenceVersionId },
          data: {
            status: 'PROCESSING_FAILED',
            storage_reconciliation_required: true,
            storage_reconciliation_status: 'REQUIRED',
            storage_reconciliation_last_error: error instanceof Error ? error.message.slice(0, 1000) : failureCode,
          },
        }).catch(() => undefined);
        await this.prisma.uploadIntent.update({
          where: { id: uploadIntent.id },
          data: { status: 'FAILED', failed_at: new Date(), failure_code: failureCode },
        }).catch(() => undefined);
      } else {
        await this.prisma.uploadIntent.update({
          where: { id: uploadIntent.id },
          data: { status: 'FAILED', failed_at: new Date(), failure_code: failureCode },
        }).catch(() => undefined);
      }
      throw error;
    }
  }

  async approveEvidenceVersion(params: {
    tenant: TenantContext;
    versionId: string;
    body: EvidenceApproveBody;
    audit: RequestAuditContext;
  }) {
    requirePermission(params.tenant, 'evidence.review');
    const repo = new EvidenceRepository(this.prisma);
    const version = await repo.findEvidenceVersionInTenantScope({ tenant: params.tenant, versionId: params.versionId });
    if (!version || version.evidence_item.archived_at) {
      throw new AppError({ statusCode: 404, code: 'EVIDENCE_VERSION_NOT_FOUND', message: 'Evidence version was not found.' });
    }

    assertEvidenceCanBeApproved({
      state: { status: version.status, securityScanStatus: version.security_scan_status },
      env: this.env,
    });
    assertValidityRange(params.body);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.evidenceItem.findFirstOrThrow({
        where: { id: version.evidence_item_id, company_id: params.tenant.companyId, archived_at: null },
      });

      const previousApprovedId = item.current_approved_version_id && item.current_approved_version_id !== version.id
        ? item.current_approved_version_id
        : null;

      if (previousApprovedId) {
        assertExactlyOneRowUpdated(
          await tx.evidenceVersion.updateMany({
            where: { id: previousApprovedId, status: 'APPROVED', evidence_item_id: item.id },
            data: { status: 'SUPERSEDED' },
          }),
          'Previous approved evidence version changed before replacement approval could be committed.',
          [{ field: 'previousApprovedVersionId', reason: previousApprovedId }],
        );
      }

      assertNoConcurrentTerminalState({
        count: (await tx.evidenceVersion.updateMany({
          where: {
            id: version.id,
            status: 'NEEDS_REVIEW',
            evidence_item: { company_id: params.tenant.companyId, archived_at: null },
          },
          data: {
            status: 'APPROVED',
            effective_from: params.body.effectiveFrom ?? version.effective_from,
            effective_until: params.body.effectiveUntil ?? version.effective_until,
            expiry_date: params.body.expiryDate ?? version.expiry_date,
            supersedes_version_id: previousApprovedId ?? version.supersedes_version_id,
          },
        })).count,
        entity: 'Evidence version',
        id: version.id,
        expectedState: 'NEEDS_REVIEW',
      });
      const approved = await tx.evidenceVersion.findUniqueOrThrow({ where: { id: version.id } });

      await tx.evidenceReview.create({
        data: {
          evidence_version_id: approved.id,
          reviewer_user_id: params.tenant.userId,
          decision: 'APPROVED',
          review_note: params.body.reviewNote,
        },
      });

      assertExactlyOneRowUpdated(
        await tx.evidenceItem.updateMany({
          where: { id: item.id, company_id: params.tenant.companyId, current_approved_version_id: item.current_approved_version_id },
          data: {
            current_approved_version_id: approved.id,
            latest_version_id: item.latest_version_id ?? approved.id,
          },
        }),
        'Evidence item current-approved pointer changed before approval could be committed.',
        [{ field: 'expectedCurrentApprovedVersionId', reason: item.current_approved_version_id ?? 'null' }],
      );

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'EVIDENCE_APPROVED',
        entityType: 'evidence_version',
        entityId: approved.id,
        metadata: {
          evidenceItemId: item.id,
          versionNo: approved.version_no,
          previousApprovedVersionId: previousApprovedId,
          supersededPreviousApprovedVersion: Boolean(previousApprovedId),
          effectiveFrom: approved.effective_from,
          effectiveUntil: approved.effective_until,
          expiryDate: approved.expiry_date,
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });

      return tx.evidenceItem.findUniqueOrThrow({
        where: { id: item.id },
        include: { latest_version: true, current_approved_version: true, versions: { orderBy: { version_no: 'desc' }, take: 20, include: { reviews: { orderBy: { created_at: 'desc' }, take: 5 } } } },
      });
    });
  }

  async rejectEvidenceVersion(params: {
    tenant: TenantContext;
    versionId: string;
    body: EvidenceRejectBody;
    audit: RequestAuditContext;
  }) {
    requirePermission(params.tenant, 'evidence.review');
    const version = await new EvidenceRepository(this.prisma).findEvidenceVersionInTenantScope({ tenant: params.tenant, versionId: params.versionId });
    if (!version || version.evidence_item.archived_at) {
      throw new AppError({ statusCode: 404, code: 'EVIDENCE_VERSION_NOT_FOUND', message: 'Evidence version was not found.' });
    }

    assertEvidenceCanBeRejected({ status: version.status });

    return this.prisma.$transaction(async (tx) => {
      assertNoConcurrentTerminalState({
        count: (await tx.evidenceVersion.updateMany({
          where: {
            id: version.id,
            status: 'NEEDS_REVIEW',
            evidence_item: { company_id: params.tenant.companyId, archived_at: null },
          },
          data: { status: 'REJECTED' },
        })).count,
        entity: 'Evidence version',
        id: version.id,
        expectedState: 'NEEDS_REVIEW',
      });
      const rejected = await tx.evidenceVersion.findUniqueOrThrow({ where: { id: version.id } });

      await tx.evidenceReview.create({
        data: {
          evidence_version_id: rejected.id,
          reviewer_user_id: params.tenant.userId,
          decision: 'REJECTED',
          reason: params.body.reason,
          review_note: params.body.reviewNote,
        },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'EVIDENCE_REJECTED',
        entityType: 'evidence_version',
        entityId: rejected.id,
        metadata: {
          evidenceItemId: version.evidence_item_id,
          versionNo: rejected.version_no,
          reason: params.body.reason,
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });

      return tx.evidenceItem.findUniqueOrThrow({
        where: { id: version.evidence_item_id },
        include: { latest_version: true, current_approved_version: true, versions: { orderBy: { version_no: 'desc' }, take: 20, include: { reviews: { orderBy: { created_at: 'desc' }, take: 5 } } } },
      });
    });
  }

  async archiveEvidenceItem(params: {
    tenant: TenantContext;
    evidenceItemId: string;
    body: EvidenceArchiveBody;
    audit: RequestAuditContext;
  }) {
    requirePermission(params.tenant, 'evidence.review');
    const evidence = await new EvidenceRepository(this.prisma).findEvidenceItemInTenantScope({ tenant: params.tenant, evidenceItemId: params.evidenceItemId });
    if (!evidence || evidence.archived_at) {
      throw new AppError({ statusCode: 404, code: 'EVIDENCE_NOT_FOUND', message: 'Evidence was not found.' });
    }

    return this.prisma.$transaction(async (tx) => {
      assertExactlyOneRowUpdated(
        await tx.evidenceItem.updateMany({ where: { id: evidence.id, company_id: params.tenant.companyId, archived_at: null }, data: { archived_at: new Date() } }),
        'Evidence item was concurrently archived before this archive request could be committed.',
        [{ field: 'expectedArchivedAt', reason: 'null' }],
      );
      const archived = await tx.evidenceItem.findUniqueOrThrow({
        where: { id: evidence.id },
        include: { latest_version: true, current_approved_version: true },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'EVIDENCE_ARCHIVED',
        entityType: 'evidence_item',
        entityId: archived.id,
        metadata: {
          reason: params.body.reason,
          latestVersionId: archived.latest_version_id,
          currentApprovedVersionId: archived.current_approved_version_id,
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });

      return archived;
    });
  }

  async getAuthorizedDownload(params: { tenant: TenantContext; versionId: string; audit?: RequestAuditContext }) {
    requirePermission(params.tenant, 'evidence.read');
    const auditorGrant = await new AuditorAccessService(this.prisma).assertAuditorCanAccessEvidenceVersion({ tenant: params.tenant, versionId: params.versionId, requireDownload: true });
    const version = await new EvidenceRepository(this.prisma).findEvidenceVersionInTenantScope({ tenant: params.tenant, versionId: params.versionId });
    if (!version) {
      throw new AppError({ statusCode: 404, code: 'EVIDENCE_VERSION_NOT_FOUND', message: 'Evidence version was not found.' });
    }
    // Pass 25/26 continuity marker: version.status === 'SECURITY_REJECTED' || version.status === 'QUARANTINED' -> EVIDENCE_DOWNLOAD_BLOCKED.
    assertEvidenceDownloadSecurityClearance({ status: version.status });
    if (!version.object_finalized_at || version.storage_reconciliation_required) {
      throw new AppError({ statusCode: 409, code: 'EVIDENCE_OBJECT_NOT_FINALIZED', message: 'Evidence object is not finalized for download.' });
    }
    if (!(await this.storage.objectExists(version.storage_key))) {
      await this.prisma.evidenceVersion.updateMany({ where: { id: version.id, storage_reconciliation_required: false }, data: { storage_reconciliation_required: true } });
      throw new AppError({ statusCode: 409, code: 'EVIDENCE_OBJECT_MISSING', message: 'Evidence object requires storage reconciliation.' });
    }

    if (params.audit) {
      await new AuditLogService(this.prisma).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'EVIDENCE_DOWNLOADED',
        entityType: 'evidence_version',
        entityId: version.id,
        metadata: {
          evidenceItemId: version.evidence_item_id,
          versionNo: version.version_no,
          auditorAccessUsed: params.tenant.role === 'AUDITOR',
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });
      await new AuditorAccessService(this.prisma).recordAuditorSensitiveDownload({
        tenant: params.tenant,
        resourceType: 'evidence_version',
        resourceId: version.id,
        scopeType: auditorGrant?.scope_type ?? 'EVIDENCE_VERSION',
        scopeId: auditorGrant?.scope_id ?? version.id,
        auditorAccessGrantId: auditorGrant?.id,
        audit: params.audit,
      });
    }

    return {
      fileName: safeDownloadFilename(version.file_name),
      mimeType: version.mime_type,
      fileSize: version.file_size,
      stream: this.storage.createReadStream(version.storage_key),
    };
  }
}
