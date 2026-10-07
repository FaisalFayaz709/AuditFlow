import { AppError, tenantSafeNotFoundError } from '../../shared/errors.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import { hasPermission, isAuditorTenant, requirePermission, type PermissionAction } from './permissions.js';

export const authorizationPredicateIds = [
  'public.no_tenant_data',
  'auth.csrf.issue',
  'auth.me',
  'auth.password.change',
  'auth.session.revoke_self',
  'tenant.active_membership',
  'tenant.scoped_entity_lookup',
  'companies.create',
  'companies.read_current',
  'company.read',
  'company.update',
  'company.profile.update',
  'members.read',
  'members.manage',
  'members.remove',
  'members.role.change',
  'invitations.read',
  'invitations.manage',
  'invitations.accept_self',
  'frameworks.read',
  'frameworks.manage',
  'frameworks.enable',
  'controls.read',
  'controls.manage',
  'controls.manage_applicability',
  'dashboard.read',
  'dashboard.readiness_trace',
  'controls.readiness_explanation',
  'tasks.read',
  'tasks.read_assigned',
  'tasks.read_all',
  'tasks.submit_assigned',
  'tasks.update_assigned',
  'tasks.manage',
  'tasks.review',
  'comments.read',
  'comments.create',
  'comments.update',
  'comments.delete',
  'evidence.read',
  'evidence.upload',
  'evidence.review',
  'evidence.manage',
  'mapping.read',
  'mapping.create',
  'mapping.review',
  'reports.generate',
  'reports.read',
  'reports.read_selected',
  'audit_logs.read',
  'auditor_grants.manage',
  'auditor_grants.read',
  'auditor.active_scope_grant',
  'deletion_requests.manage',
  'retention.read',
  'retention.manage',
  'notifications.read',
  'jobs.manage',
  'ai.read',
  'ai.run',
] as const;

export type AuthorizationPredicateId = (typeof authorizationPredicateIds)[number];

export const authorizationPredicates: Record<AuthorizationPredicateId, string> = {
  'public.no_tenant_data': 'Public route returns no tenant-owned business data.',
  'auth.csrf.issue': 'Named authorization predicate for auth.csrf.issue.',
  'auth.me': 'Named authorization predicate for auth.me.',
  'auth.password.change': 'Named authorization predicate for auth.password.change.',
  'auth.session.revoke_self': 'Named authorization predicate for auth.session.revoke_self.',
  'tenant.active_membership': 'Active tenant membership is required and must be resolved from server-side session context.',
  'tenant.scoped_entity_lookup': 'Services load target entities inside tenant scope; foreign IDs behave as not found.',
  'companies.create': 'Named authorization predicate for companies.create.',
  'companies.read_current': 'Named authorization predicate for companies.read_current.',
  'company.read': 'Named authorization predicate for company.read.',
  'company.update': 'Named authorization predicate for company.update.',
  'company.profile.update': 'Named authorization predicate for company.profile.update.',
  'members.read': 'Named authorization predicate for members.read.',
  'members.manage': 'Named authorization predicate for members.manage.',
  'members.remove': 'Named authorization predicate for members.remove.',
  'members.role.change': 'Named authorization predicate for members.role.change.',
  'invitations.read': 'Named authorization predicate for invitations.read.',
  'invitations.manage': 'Named authorization predicate for invitations.manage.',
  'invitations.accept_self': 'Named authorization predicate for invitations.accept_self.',
  'frameworks.read': 'Named authorization predicate for frameworks.read.',
  'frameworks.manage': 'OWNER, ADMIN, or COMPLIANCE_MANAGER may enroll, publish, or reconcile frameworks.',
  'frameworks.enable': 'Backward-compatible framework management predicate; same role set as frameworks.manage.',
  'controls.read': 'Named authorization predicate for controls.read.',
  'controls.manage': 'Named authorization predicate for controls.manage.',
  'controls.manage_applicability': 'OWNER, ADMIN, or COMPLIANCE_MANAGER; NOT_APPLICABLE requires reason and actor attribution.',
  'dashboard.read': 'Named authorization predicate for dashboard.read.',
  'dashboard.readiness_trace': 'Readiness trace loads only active tenant-scoped controls, requirements, mappings, evidence versions, and validity state.',
  'controls.readiness_explanation': 'Control readiness explanation resolves the target company control inside the active tenant scope before returning trace details.',
  'tasks.read': 'Named authorization predicate for tasks.read.',
  'tasks.read_assigned': 'Member reads only tasks assigned to the active user unless tasks.read_all is present.',
  'tasks.read_all': 'OWNER, ADMIN, or COMPLIANCE_MANAGER can read all tenant tasks.',
  'tasks.submit_assigned': 'Assigned member may start, submit, and comment; cannot reassign, approve, or change requirements.',
  'tasks.update_assigned': 'Named authorization predicate for tasks.update_assigned.',
  'tasks.manage': 'Named authorization predicate for tasks.manage.',
  'tasks.review': 'Named authorization predicate for tasks.review.',
  'comments.read': 'Named authorization predicate for comments.read.',
  'comments.create': 'Named authorization predicate for comments.create.',
  'comments.update': 'Named authorization predicate for comments.update.',
  'comments.delete': 'Named authorization predicate for comments.delete.',
  'evidence.read': 'Tenant membership plus evidence.read; auditors additionally require an active covering grant.',
  'evidence.upload': 'Tenant membership plus evidence.upload; auditors do not upload evidence by default.',
  'evidence.review': 'OWNER, ADMIN, or COMPLIANCE_MANAGER with evidence.review.',
  'evidence.manage': 'Named authorization predicate for evidence.manage.',
  'mapping.read': 'Named authorization predicate for mapping.read.',
  'mapping.create': 'Named authorization predicate for mapping.create.',
  'mapping.review': 'OWNER, ADMIN, or COMPLIANCE_MANAGER with mapping.review.',
  'reports.generate': 'OWNER, ADMIN, or COMPLIANCE_MANAGER may generate tenant reports.',
  'reports.read': 'Tenant report read for managers; auditors require an active covering report/framework/control grant.',
  'reports.read_selected': 'Named authorization predicate for reports.read_selected.',
  'audit_logs.read': 'OWNER, ADMIN, COMPLIANCE_MANAGER; auditors only through explicit grant and filtered projection.',
  'auditor_grants.manage': 'OWNER, ADMIN, or COMPLIANCE_MANAGER may create/revoke scoped auditor grants.',
  'auditor_grants.read': 'Named authorization predicate for auditor_grants.read.',
  'auditor.active_scope_grant': 'AUDITOR role must have an active, unrevoked, unexpired grant covering the requested scope.',
  'deletion_requests.manage': 'OWNER or ADMIN may manage policy-controlled purge workflows unless stricter policy applies.',
  'retention.read': 'Named authorization predicate for retention.read.',
  'retention.manage': 'Named authorization predicate for retention.manage.',
  'notifications.read': 'Named authorization predicate for notifications.read.',
  'jobs.manage': 'Named authorization predicate for jobs.manage.',
  'ai.read': 'Named authorization predicate for ai.read.',
  'ai.run': 'Named authorization predicate for ai.run.',
};

export type TenantScopedResource = {
  id: string;
  company_id: string;
};

export function tenantScopedWhere<T extends Record<string, unknown>>(tenant: TenantContext, extra: T): T & { company_id: string } {
  return { ...extra, company_id: tenant.companyId };
}

export function assertTenantScopedResource(params: {
  tenant: TenantContext;
  resource: TenantScopedResource | null;
  entityType: string;
  entityId: string;
}): TenantScopedResource {
  if (!params.resource || params.resource.company_id !== params.tenant.companyId) {
    throwTenantSafeNotFound(params.entityType, params.entityId);
  }
  return params.resource;
}

export function throwTenantSafeNotFound(entityType: string, entityId: string): never {
  void entityId;
  throw tenantSafeNotFoundError(entityType);
}

export function requireNamedPredicate(params: {
  tenant: TenantContext;
  permission: PermissionAction;
  predicateId: AuthorizationPredicateId;
}): void {
  if (!authorizationPredicates[params.predicateId]) {
    throw new AppError({
      statusCode: 500,
      code: 'UNKNOWN_AUTHORIZATION_PREDICATE',
      message: 'The route references an unknown authorization predicate.',
      details: [{ field: 'predicateId', reason: params.predicateId }],
    });
  }
  requirePermission(params.tenant, params.permission);
}

export function assertTaskReadPredicate(params: {
  tenant: TenantContext;
  assignedToUserId: string | null;
}): void {
  if (hasPermission(params.tenant.role, 'tasks.read_all')) return;
  if (params.assignedToUserId === params.tenant.userId && hasPermission(params.tenant.role, 'tasks.read_assigned')) return;
  throw new AppError({
    statusCode: 403,
    code: 'TASK_ACCESS_DENIED',
    message: 'You may only read tasks assigned to you unless you have task-wide read permission.',
  });
}

export function assertTaskSubmitPredicate(params: {
  tenant: TenantContext;
  assignedToUserId: string | null;
}): void {
  if (hasPermission(params.tenant.role, 'tasks.manage')) return;
  if (params.assignedToUserId === params.tenant.userId && hasPermission(params.tenant.role, 'tasks.submit_assigned')) return;
  throw new AppError({
    statusCode: 403,
    code: 'TASK_SUBMISSION_DENIED',
    message: 'Only an assigned member or a task manager may change this task.',
  });
}

export function requireAuditorGrantPredicate(params: {
  tenant: TenantContext;
  hasActiveGrant: boolean;
  scopeDescription: string;
}): void {
  if (!isAuditorTenant(params.tenant)) return;
  if (params.hasActiveGrant) return;
  throw new AppError({
    statusCode: 403,
    code: 'AUDITOR_GRANT_REQUIRED',
    message: 'Auditor access requires an active scoped grant.',
    details: [{ field: 'scope', reason: params.scopeDescription }],
  });
}
