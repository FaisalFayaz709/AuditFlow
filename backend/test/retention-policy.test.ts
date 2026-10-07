import { describe, expect, it } from 'vitest';
import { CreateDeletionRequestBodySchema, CreateLegalHoldBodySchema } from '../src/modules/retention/retention.schemas.js';

const schemaText = await import('node:fs').then((fs) => fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8'));
const serviceText = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/modules/retention/retention.service.ts', import.meta.url), 'utf8'));

describe('Pass 18 retention/deletion/legal-hold policy', () => {
  it('requires explicit backup-limitation acknowledgement for deletion requests', () => {
    expect(() => CreateDeletionRequestBodySchema.parse({ entityType: 'EVIDENCE_ITEM', entityId: 'ev_1', reason: 'remove stale evidence item after retention window' })).toThrow();
    expect(CreateDeletionRequestBodySchema.parse({ entityType: 'EVIDENCE_ITEM', entityId: 'ev_1', reason: 'remove stale evidence item after retention window', backupLimitationAcknowledged: true }).backupLimitationAcknowledged).toBe(true);
  });

  it('supports company-wide legal holds only when entity fields are omitted together', () => {
    expect(CreateLegalHoldBodySchema.parse({ reason: 'company-wide litigation preservation hold' }).entityType).toBeUndefined();
    expect(() => CreateLegalHoldBodySchema.parse({ entityType: 'REPORT', reason: 'invalid partial legal hold' })).toThrow();
  });

  it('keeps canonical deletion request status enum and legal hold tables in Prisma schema', () => {
    expect(schemaText).toContain('enum DeletionRequestStatus');
    expect(schemaText).toContain('REQUESTED');
    expect(schemaText).toContain('SCHEDULED');
    expect(schemaText).toContain('COMPLETED');
    expect(schemaText).toContain('model DeletionRequest');
    expect(schemaText).toContain('model LegalHold');
  });

  it('blocks purge while legal hold is active and uses a waiting period', () => {
    expect(serviceText).toContain('LEGAL_HOLD_ACTIVE');
    expect(serviceText).toContain('MIN_PURGE_WAIT_DAYS = 7');
    expect(serviceText).toContain('backupLimitationAcknowledged');
    expect(serviceText).toContain('DELETION_COMPLETED');
  });
});
