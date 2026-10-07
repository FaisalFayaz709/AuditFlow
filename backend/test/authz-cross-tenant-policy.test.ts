import { describe, expect, it } from 'vitest';
import { permissionActions, hasPermission } from '../src/modules/authz/permissions.js';
import {
  assertTaskReadPredicate,
  assertTaskSubmitPredicate,
  assertTenantScopedResource,
  authorizationPredicateIds,
  authorizationPredicates,
  requireAuditorGrantPredicate,
  tenantScopedWhere,
} from '../src/modules/authz/predicates.js';
import { assertAuthorized } from '../src/modules/authz/assert-authorized.js';
import type { TenantContext } from '../src/shared/tenant-context.js';

function tenant(role: TenantContext['role'], overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    companyId: 'company_a',
    userId: 'user_a',
    membershipId: 'membership_a',
    role,
    ...overrides,
  };
}

describe('Pass 29 centralized authorization predicates', () => {
  it('defines the canonical predicates required by v2.1', () => {
    for (const predicate of [
      'tasks.read_assigned',
      'tasks.read_all',
      'tasks.submit_assigned',
      'evidence.read',
      'evidence.upload',
      'evidence.review',
      'mapping.review',
      'controls.manage_applicability',
      'frameworks.manage',
      'reports.generate',
      'reports.read',
      'audit_logs.read',
      'auditor_grants.manage',
      'deletion_requests.manage',
      'auditor.active_scope_grant',
      'tenant.scoped_entity_lookup',
    ]) {
      expect(authorizationPredicateIds).toContain(predicate);
      expect(authorizationPredicates[predicate as (typeof authorizationPredicateIds)[number]]).toBeTruthy();
    }
  });

  it('keeps all contract permissions represented in the central permission registry', () => {
    for (const permission of [
      'evidence.read',
      'evidence.upload',
      'evidence.review',
      'mapping.review',
      'tasks.read_assigned',
      'tasks.read_all',
      'reports.read',
      'audit_logs.read',
      'auditor_grants.manage',
      'deletion_requests.manage',
    ]) {
      expect(permissionActions).toContain(permission);
    }
  });

  it('requires both permission and named predicate', () => {
    expect(() => assertAuthorized({ tenant: tenant('COMPLIANCE_MANAGER'), permission: 'evidence.review', predicateId: 'evidence.review' })).not.toThrow();
    expect(() => assertAuthorized({ tenant: tenant('MEMBER'), permission: 'evidence.review', predicateId: 'evidence.review' })).toThrowError(/permission/i);
  });

  it('keeps members limited to assigned task reads and submissions', () => {
    expect(() => assertTaskReadPredicate({ tenant: tenant('MEMBER'), assignedToUserId: 'user_a' })).not.toThrow();
    expect(() => assertTaskSubmitPredicate({ tenant: tenant('MEMBER'), assignedToUserId: 'user_a' })).not.toThrow();
    expect(() => assertTaskReadPredicate({ tenant: tenant('MEMBER'), assignedToUserId: 'user_b' })).toThrowError(/task/i);
    expect(() => assertTaskSubmitPredicate({ tenant: tenant('MEMBER'), assignedToUserId: 'user_b' })).toThrowError(/task/i);
  });

  it('loads resources through tenant scope and hides foreign IDs as not found', () => {
    expect(tenantScopedWhere(tenant('OWNER'), { id: 'evidence_a' })).toEqual({ company_id: 'company_a', id: 'evidence_a' });
    expect(() => assertTenantScopedResource({ tenant: tenant('OWNER'), resource: { id: 'evidence_a', company_id: 'company_a' }, entityType: 'evidence', entityId: 'evidence_a' })).not.toThrow();
    expect(() => assertTenantScopedResource({ tenant: tenant('OWNER'), resource: { id: 'evidence_b', company_id: 'company_b' }, entityType: 'evidence', entityId: 'evidence_b' })).toThrowError(/not found/i);
  });

  it('requires explicit scoped grants for auditors while leaving managers unaffected', () => {
    expect(hasPermission('AUDITOR', 'evidence.read')).toBe(true);
    expect(() => requireAuditorGrantPredicate({ tenant: tenant('AUDITOR'), hasActiveGrant: false, scopeDescription: 'evidence:e1' })).toThrowError(/grant/i);
    expect(() => requireAuditorGrantPredicate({ tenant: tenant('AUDITOR'), hasActiveGrant: true, scopeDescription: 'evidence:e1' })).not.toThrow();
    expect(() => requireAuditorGrantPredicate({ tenant: tenant('COMPLIANCE_MANAGER'), hasActiveGrant: false, scopeDescription: 'evidence:e1' })).not.toThrow();
  });
});
