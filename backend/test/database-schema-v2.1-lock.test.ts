import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const schema = fs.readFileSync(path.join(root, 'backend/prisma/schema.prisma'), 'utf8');

function block(name: string): string {
  const match = schema.match(new RegExp(`(?:model|enum)\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  if (!match) throw new Error(`${name} not found in schema.prisma`);
  return match[1];
}

function allMigrationSql(): string {
  const dir = path.join(root, 'backend/prisma/migrations');
  return fs
    .readdirSync(dir)
    .sort()
    .map((entry) => {
      const file = path.join(dir, entry, 'migration.sql');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    })
    .join('\n');
}

describe('v2.1 database schema lock', () => {
  it('keeps the canonical v2.1 enums and forbids superseded task/current-version wording', () => {
    expect(block('ControlType')).toContain('EVIDENCE_BASED');
    expect(block('ControlType')).toContain('INFORMATIONAL');
    expect(block('EvidenceVersionStatus')).toContain('QUARANTINED');
    expect(block('EvidenceVersionStatus')).toContain('SECURITY_REJECTED');
    expect(block('SecurityScanStatus')).toContain('CLEAN');
    expect(block('TaskStatus')).toContain('COMPLETED');
    expect(block('UploadIntentStatus')).toContain('CREATED');
    expect(block('UploadIntentStatus')).toContain('FINALIZED');
    expect(block('StorageReconciliationStatus')).toContain('RECONCILED');
    expect(block('TaskStatus')).not.toMatch(/(^|\s)APPROVED(\s|$)/m);
    expect(schema).not.toContain('current_version_id');
  });

  it('models the v2.1 evidence item pointers and malware/finalization fields', () => {
    expect(block('EvidenceItem')).toMatch(/latest_version_id\s+String\?/);
    expect(block('EvidenceItem')).toMatch(/current_approved_version_id\s+String\?/);
    expect(block('EvidenceVersion')).toMatch(/security_scan_status\s+SecurityScanStatus\s+@default\(PENDING\)/);
    expect(block('EvidenceVersion')).toMatch(/security_scan_completed_at\s+DateTime\?/);
    expect(block('EvidenceVersion')).toMatch(/quarantine_reason\s+String\?/);
    expect(block('EvidenceVersion')).toMatch(/object_finalized_at\s+DateTime\?/);
    expect(block('EvidenceVersion')).toMatch(/storage_reconciliation_status\s+StorageReconciliationStatus\s+@default\(NOT_REQUIRED\)/);
    expect(block('EvidenceVersion')).toMatch(/storage_reconciliation_attempts\s+Int\s+@default\(0\)/);
  });

  it('does not leave invalid report inverse relations on controls or requirements', () => {
    expect(block('Control')).not.toMatch(/reports\s+Report\[\]/);
    expect(block('EvidenceRequirement')).not.toMatch(/reports\s+Report\[\]/);
    expect(block('Report')).toMatch(/company\s+Company\s+@relation/);
  });

  it('preserves v2.1 partial unique index migrations that Prisma schema cannot express', () => {
    const migrations = allMigrationSql();
    expect(migrations).toMatch(/company_frameworks_one_active_per_company_family_idx[\s\S]*WHERE\s+"status"\s*=\s*'ACTIVE'/i);
    expect(migrations).toMatch(/evidence_control_mappings_approved_version_requirement_uidx[\s\S]*WHERE\s+"status"\s*=\s*'APPROVED'/i);
    expect(migrations).toMatch(/auditor_access_grants_one_active_scope_per_auditor_idx[\s\S]*WHERE\s+"revoked_at"\s+IS\s+NULL/i);
  });

  it('uses restrict/history-first delete behavior for core compliance records', () => {
    expect(block('EvidenceVersion')).toMatch(/evidence_item\s+EvidenceItem\s+@relation\([^)]*onDelete:\s*Restrict[^)]*\)/s);
    expect(block('EvidenceReview')).toMatch(/evidence_version\s+EvidenceVersion\s+@relation\([^)]*onDelete:\s*Restrict[^)]*\)/s);
    expect(block('EvidenceControlMapping')).toMatch(/evidence_version\s+EvidenceVersion\s+@relation\([^)]*onDelete:\s*Restrict[^)]*\)/s);
    expect(block('TaskEvidence')).toMatch(/evidence_version\s+EvidenceVersion\s+@relation\([^)]*onDelete:\s*Restrict[^)]*\)/s);
    expect(allMigrationSql()).not.toMatch(/ON\s+DELETE\s+CASCADE/i);
  });
});
