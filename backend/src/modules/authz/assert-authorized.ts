import type { TenantContext } from '../../shared/tenant-context.js';
import { requireNamedPredicate, type AuthorizationPredicateId } from './predicates.js';
import type { PermissionAction } from './permissions.js';

export type AuthorizationAssertion = {
  tenant: TenantContext;
  permission: PermissionAction;
  predicateId: AuthorizationPredicateId;
};

export function assertAuthorized(assertion: AuthorizationAssertion): void {
  requireNamedPredicate(assertion);
}
