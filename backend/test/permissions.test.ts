import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import { hasPermission, listPermissionsForRole, requirePermission } from '../src/modules/authz/permissions.js';
import type { TenantContext } from '../src/shared/tenant-context.js';

function tenant(role: TenantContext['role']): TenantContext {
  return {
    companyId: 'company_a',
    userId: 'user_a',
    membershipId: 'membership_a',
    role,
  };
}

describe('central permission predicates', () => {
  it('allows compliance managers to review evidence and mappings', () => {
    expect(hasPermission('COMPLIANCE_MANAGER', 'evidence.review')).toBe(true);
    expect(hasPermission('COMPLIANCE_MANAGER', 'mapping.create')).toBe(true);
    expect(hasPermission('COMPLIANCE_MANAGER', 'mapping.review')).toBe(true);
    expect(hasPermission('COMPLIANCE_MANAGER', 'dashboard.read')).toBe(true);
  });

  it('prevents members from approving evidence', () => {
    expect(hasPermission('MEMBER', 'evidence.review')).toBe(false);
    expect(() => requirePermission(tenant('MEMBER'), 'evidence.review')).toThrowError(AppError);
    expect(() => requirePermission(tenant('MEMBER'), 'mapping.create')).toThrowError(AppError);
  });

  it('keeps auditors read-oriented at this pass boundary', () => {
    expect(hasPermission('AUDITOR', 'evidence.read')).toBe(true);
    expect(hasPermission('AUDITOR', 'evidence.upload')).toBe(false);
    expect(hasPermission('AUDITOR', 'reports.generate')).toBe(false);
    expect(hasPermission('AUDITOR', 'mapping.review')).toBe(false);
    expect(hasPermission('AUDITOR', 'dashboard.read')).toBe(false);
  });

  it('exposes named permissions for documentation and route declarations', () => {
    expect(listPermissionsForRole('OWNER')).toContain('audit_logs.read');
    expect(listPermissionsForRole('OWNER')).toContain('members.manage');
    expect(listPermissionsForRole('OWNER')).toContain('frameworks.manage');
    expect(listPermissionsForRole('OWNER')).toContain('controls.manage_applicability');
    expect(listPermissionsForRole('OWNER')).toContain('deletion_requests.manage');
  });
});
