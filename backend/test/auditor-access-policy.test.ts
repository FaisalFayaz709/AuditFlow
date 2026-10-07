import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hasPermission } from '../src/modules/authz/permissions.js';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Pass 17 auditor access policy', () => {
  it('does not let an auditor manage grants', () => {
    expect(hasPermission('AUDITOR', 'auditor_grants.manage')).toBe(false);
    expect(hasPermission('AUDITOR', 'auditor_grants.read')).toBe(true);
    expect(hasPermission('OWNER', 'auditor_grants.manage')).toBe(true);
    expect(hasPermission('COMPLIANCE_MANAGER', 'auditor_grants.manage')).toBe(true);
  });

  it('models time-bounded selected auditor scopes', () => {
    const schema = read('backend/prisma/schema.prisma');
    expect(schema).toContain('enum AuditorScopeType');
    expect(schema).toContain('FRAMEWORK');
    expect(schema).toContain('CONTROL');
    expect(schema).toContain('EVIDENCE_ITEM');
    expect(schema).toContain('EVIDENCE_VERSION');
    expect(schema).toContain('REPORT');
    expect(schema).toContain('model AuditorAccessGrant');
    expect(schema).toContain('starts_at');
    expect(schema).toContain('expires_at');
    expect(schema).toContain('revoked_at');
    expect(schema).toContain('download_allowed');
  });

  it('requires active grants for auditor evidence and report access', () => {
    const service = read('backend/src/modules/auditor-access/auditor-access.service.ts');
    expect(service).toContain('assertAuditorCanAccessEvidenceVersion');
    expect(service).toContain('assertAuditorCanAccessReport');
    expect(service).toContain('AUDITOR_GRANT_REQUIRED');
    expect(service).toContain('AUDITOR_DOWNLOAD_GRANT_REQUIRED');
    expect(service).toContain('MAX_GRANT_DAYS = 90');
  });

  it('audits grant creation and revocation', () => {
    const service = read('backend/src/modules/auditor-access/auditor-access.service.ts');
    expect(service).toContain('AUDITOR_ACCESS_GRANTED');
    expect(service).toContain('AUDITOR_ACCESS_REVOKED');
  });
});
