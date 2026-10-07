import type { PrismaClient } from '@prisma/client';
import type { PrivateObjectStorage } from '../storage/storage.types.js';
import { assertExactlyOneRowUpdated } from '../../shared/concurrency.js';

export type StorageReconciliationResult = {
  expiredUploadIntents?: number;
  temporaryObjectsDeleted?: number;
  reconciledEvidenceVersions?: number;
  failedEvidenceVersions?: number;
};

export class StorageReconciliationService {
  constructor(private readonly prisma: PrismaClient, private readonly storage: PrivateObjectStorage) {}

  async cleanupExpiredTemporaryUploads(params: { companyId?: string; asOf?: Date; limit?: number }): Promise<StorageReconciliationResult> {
    const asOf = params.asOf ?? new Date();
    const intents = await this.prisma.uploadIntent.findMany({
      where: {
        ...(params.companyId ? { company_id: params.companyId } : {}),
        status: { in: ['CREATED', 'UPLOADED', 'VALIDATING', 'FAILED'] },
        expires_at: { lt: asOf },
        temp_deleted_at: null,
      },
      orderBy: { expires_at: 'asc' },
      take: params.limit ?? 250,
    });

    let deleted = 0;
    for (const intent of intents) {
      await this.storage.deleteObject(intent.temporary_storage_key).catch(() => undefined);
      const expired = await this.prisma.uploadIntent.updateMany({
        where: { id: intent.id, status: intent.status, temp_deleted_at: null },
        data: {
          status: 'EXPIRED',
          temp_deleted_at: new Date(),
          failed_at: intent.failed_at ?? new Date(),
          failure_code: intent.failure_code ?? 'UPLOAD_INTENT_EXPIRED',
        },
      });
      if (expired.count === 1) deleted += 1;
    }

    return { expiredUploadIntents: intents.length, temporaryObjectsDeleted: deleted };
  }

  async reconcileEvidenceObjects(params: { companyId?: string; evidenceVersionId?: string; limit?: number }): Promise<StorageReconciliationResult> {
    const versions = await this.prisma.evidenceVersion.findMany({
      where: {
        ...(params.evidenceVersionId ? { id: params.evidenceVersionId } : {}),
        ...(params.companyId ? { evidence_item: { company_id: params.companyId } } : {}),
        storage_reconciliation_required: true,
      },
      include: {
        evidence_item: true,
        upload_intents: { orderBy: { updated_at: 'desc' }, take: 1 },
      },
      orderBy: { updated_at: 'asc' },
      take: params.limit ?? 100,
    });

    let reconciled = 0;
    let failed = 0;

    for (const version of versions) {
      const intent = version.upload_intents[0];
      const claimed = await this.prisma.evidenceVersion.updateMany({
        where: { id: version.id, storage_reconciliation_required: true, storage_reconciliation_status: { in: ['REQUIRED', 'FAILED'] } },
        data: {
          storage_reconciliation_status: 'RETRYING',
          storage_reconciliation_attempts: { increment: 1 },
        },
      });
      if (claimed.count !== 1) continue;

      try {
        const finalExists = await this.storage.objectExists(version.storage_key);
        if (finalExists) {
          await this.markVersionReconciled(version.id, intent?.id);
          reconciled += 1;
          continue;
        }

        if (!intent || !(await this.storage.objectExists(intent.temporary_storage_key))) {
          throw new Error('Neither final object nor temporary upload object exists. Manual recovery from backups may be required.');
        }

        await this.storage.moveObject(intent.temporary_storage_key, version.storage_key, {
          size: version.file_size,
          contentType: version.mime_type,
          checksumSha256: version.sha256_checksum,
          finalizedAt: new Date(),
        });
        await this.markVersionReconciled(version.id, intent.id);
        reconciled += 1;
      } catch (error) {
        failed += 1;
        await this.prisma.evidenceVersion.updateMany({
          where: { id: version.id, storage_reconciliation_status: 'RETRYING' },
          data: {
            status: 'PROCESSING_FAILED',
            storage_reconciliation_required: true,
            storage_reconciliation_status: 'FAILED',
            storage_reconciliation_last_error: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown storage reconciliation failure.',
          },
        });
      }
    }

    return { reconciledEvidenceVersions: reconciled, failedEvidenceVersions: failed };
  }

  private async markVersionReconciled(evidenceVersionId: string, uploadIntentId?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      assertExactlyOneRowUpdated(
        await tx.evidenceVersion.updateMany({
          where: { id: evidenceVersionId, storage_reconciliation_required: true, storage_reconciliation_status: 'RETRYING' },
          data: {
            object_finalized_at: new Date(),
            storage_reconciliation_required: false,
            storage_reconciliation_status: 'RECONCILED',
            storage_reconciliation_last_error: null,
          },
        }),
        'Evidence version reconciliation claim changed before completion could be committed.',
        [{ field: 'expectedStorageReconciliationStatus', reason: 'RETRYING' }],
      );
      if (uploadIntentId) {
        await tx.uploadIntent.updateMany({
          where: { id: uploadIntentId, status: { in: ['FAILED', 'FINALIZING'] } },
          data: {
            status: 'FINALIZED',
            finalized_at: new Date(),
            temp_deleted_at: new Date(),
            failure_code: null,
          },
        });
      }
    });
  }
}
