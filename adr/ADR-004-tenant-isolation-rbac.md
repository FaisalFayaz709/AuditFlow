# ADR-004: Tenant Isolation and RBAC Predicates

Status: Accepted

## Decision

Every protected operation requires:

```txt
authenticated user
+ active tenant membership
+ exact permission predicate
+ resource ownership/scope check
```

## Implementation Rules

- Never trust `company_id` from request input as authorization.
- Load target entities inside tenant scope.
- A globally existing foreign ID must not leak existence across tenants.
- Centralize permission checks.
- Routes must not duplicate ad hoc role comparisons.

## Required Helpers

```ts
requireAuthenticatedUser()
requireCompanyMembership(userId, companyId)
requirePermission(context, action, resource?)
loadEntityInTenantScope(context, entityId)
```

## Test Requirements

- Cross-tenant read blocked.
- Cross-tenant write blocked.
- Cross-tenant download blocked.
- Role bypass blocked.
- Removed membership loses access on next request.
