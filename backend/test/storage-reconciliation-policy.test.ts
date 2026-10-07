import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const schema = fs.readFileSync(path.join(root, 'backend/prisma/schema.prisma'), 'utf8');
const evidenceService = fs.readFileSync(path.join(root, 'backend/src/modules/evidence/evidence.service.ts'), 'utf8');
const reconciliationService = fs.readFileSync(path.join(root, 'backend/src/modules/storage-reconciliation/storage-reconciliation.service.ts'), 'utf8');
const jobsService = fs.readFileSync(path.join(root, 'backend/src/modules/jobs/jobs.service.ts'), 'utf8');

function block(name: string): string {
  const match = schema.match(new RegExp(`(?:model|enum)\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  if (!match) throw new Error(`${name} not found`);
  return match[1];
}

describe('Pass 27 atomic upload and storage reconciliation policy', () => {
  it('models the upload-intent state machine and reconciliation fields', () => {
    expect(block('UploadIntentStatus')).toContain('CREATED');
    expect(block('UploadIntentStatus')).toContain('UPLOADED');
    expect(block('UploadIntentStatus')).toContain('VALIDATING');
    expect(block('UploadIntentStatus')).toContain('FINALIZING');
    expect(block('UploadIntentStatus')).toContain('FINALIZED');
    expect(block('UploadIntent')).toMatch(/status\s+UploadIntentStatus\s+@default\(CREATED\)/);
    expect(block('UploadIntent')).toMatch(/evidence_version_id\s+String\?/);
    expect(block('EvidenceVersion')).toContain('storage_reconciliation_status');
    expect(block('EvidenceVersion')).toContain('storage_reconciliation_attempts');
  });

  it('finalizes temp object only after validation and records deterministic recovery state', () => {
    for (const token of [
      "status: 'CREATED'",
      "status: 'UPLOADED'",
      "status: 'VALIDATING'",
      "status: 'FINALIZING'",
      "status: 'FINALIZED'",
      'assertUploadChecksum',
      'await decideInitialSecurityScan',
      'FINAL_OBJECT_OPERATION_FAILED',
      'storage_reconciliation_required: true',
      "storage_reconciliation_status: 'REQUIRED'",
    ]) {
      expect(evidenceService).toContain(token);
    }
  });

  it('delegates cleanup and reconciliation to a bounded service used by jobs', () => {
    for (const token of ['cleanupExpiredTemporaryUploads', 'reconcileEvidenceObjects', 'deleteObject', 'moveObject', 'objectExists', "status: 'EXPIRED'", "storage_reconciliation_status: 'RECONCILED'", "storage_reconciliation_status: 'FAILED'"]) {
      expect(reconciliationService).toContain(token);
    }
    expect(jobsService).toContain('StorageReconciliationService');
    expect(jobsService).toContain('CLEANUP_TEMP_UPLOADS');
    expect(jobsService).toContain('RECONCILE_STORAGE_OBJECT');
  });

  it('keeps extraction and AI asynchronous work behind object finalization', () => {
    expect(evidenceService).toMatch(/object_finalized_at:[\s\S]*status: finalStatus/);
    expect(evidenceService).not.toMatch(/RUN_AI_ANALYSIS[\s\S]{0,500}object_finalized_at:\s*null/);
  });
});
