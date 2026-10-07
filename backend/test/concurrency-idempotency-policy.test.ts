import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const readJson = <T = any>(path: string): T => JSON.parse(read(path));

describe('Pass 28 concurrency and idempotency policy', () => {
  it('centralizes conflict and idempotency helpers', () => {
    const source = read('src/shared/concurrency.ts');
    expect(source).toContain('CONCURRENT_STATE_CHANGE');
    expect(source).toContain('assertExactlyOneRowUpdated');
    expect(source).toContain('assertNoConcurrentTerminalState');
    expect(source).toContain('normalizeIdempotencyKey');
    expect(source).toContain('isPrismaUniqueConstraintConflict');
  });

  it('guards evidence approval, rejection, archive, and upload finalization with expected-state updates', () => {
    const source = read('src/modules/evidence/evidence.service.ts');
    expect(source).toContain("status: 'NEEDS_REVIEW'");
    expect(source).toContain('assertNoConcurrentTerminalState');
    expect(source).toContain('current_approved_version_id: item.current_approved_version_id');
    expect(source).toContain('object_finalized_at: null');
    expect(source).toContain('expectedStatus');
    expect(source).toContain('normalizeIdempotencyKey');
    expect(source).toContain('isPrismaUniqueConstraintConflict');
  });

  it('guards mapping review mutations with expected mapping status', () => {
    const source = read('src/modules/mappings/mappings.service.ts');
    expect(source).toContain('assertNoConcurrentTerminalState');
    expect(source).toContain('company_id: params.tenant.companyId, status: mapping.status');
  });

  it('guards task state transitions and task updates with status or updated_at preconditions', () => {
    const source = read('src/modules/tasks/tasks.service.ts');
    expect(source).toContain('updated_at: task.updated_at');
    expect(source).toContain("status: 'SUBMITTED'");
    expect(source).toContain('assertNoConcurrentTerminalState');
    expect(source).not.toContain('tenant: params.tenant,\n        tenant: params.tenant');
  });

  it('guards framework upgrade activation, deletion execution, auditor revocation, report replay, and storage reconciliation', () => {
    expect(read('src/modules/frameworks/framework-upgrade.service.ts')).toContain('activated_at: null');
    expect(read('src/modules/frameworks/framework-upgrade.service.ts')).toContain("status: 'PENDING_REVIEW_READY'");
    expect(read('src/modules/retention/retention.service.ts')).toContain("status: 'SCHEDULED'");
    expect(read('src/modules/retention/retention.service.ts')).toContain("status: 'RUNNING'");
    expect(read('src/modules/auditor-access/auditor-access.service.ts')).toContain('revoked_at: null');
    expect(read('src/modules/reports/reports.service.ts')).toContain('isPrismaUniqueConstraintConflict');
    expect(read('src/modules/storage-reconciliation/storage-reconciliation.service.ts')).toContain("storage_reconciliation_status: 'RETRYING'");
  });



  it('adds a database-side guard against duplicate active deletion requests', () => {
    const migration = read('prisma/migrations/20260808233300_pass_28_concurrency_idempotency/migration.sql');
    expect(migration).toContain('deletion_requests_one_active_entity_idx');
    expect(migration).toContain("status IN ('REQUESTED', 'APPROVED', 'SCHEDULED', 'RUNNING')");
  });

  it('documents required route-level concurrency and idempotency behavior in API contracts', () => {
    const contracts = readJson<{ routes: Array<{ operationId: string; concurrency: { strategy: string; rule: string }; idempotency: { supported: boolean; rule: string }; errors: number[] }> }>('src/openapi/route-contracts.v1.json');
    const byOperation = new Map(contracts.routes.map((route) => [route.operationId, route]));
    for (const operationId of [
      'evidenceVersionApprove',
      'evidenceVersionReject',
      'mappingApprove',
      'mappingReject',
      'taskComplete',
      'taskReject',
      'taskCancel',
      'frameworkUpgradeActivate',
      'approveDeletionRequest',
      'runDueDeletionRequests',
    ]) {
      const route = byOperation.get(operationId);
      expect(route?.concurrency.strategy).toBe('conditional-update-precondition');
      expect(route?.errors).toContain(409);
    }
    expect(byOperation.get('reportGenerate')?.idempotency.supported).toBe(true);
    expect(byOperation.get('evidenceUpload')?.idempotency.supported).toBe(true);
    expect(byOperation.get('revokeAuditorAccessGrant')?.idempotency.supported).toBe(true);
  });
});
