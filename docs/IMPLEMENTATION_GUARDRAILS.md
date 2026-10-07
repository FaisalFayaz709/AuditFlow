# Implementation Guardrails

Use this document during planning, coding, PR review, and refactoring.

## Must Preserve

### Product Identity

AuditFlow is an AI-assisted compliance evidence manager for readiness and evidence coverage. It is not a certification engine.

### Architecture

- Modular monolith.
- One backend deployable.
- One PostgreSQL transactional database.
- Object storage for evidence binaries.
- Internal module boundaries.
- Service interfaces between modules.

### Human Accountability

Humans approve:

- evidence
- mappings
- control applicability
- readiness interpretation
- auditor-facing outputs

AI suggests only.

## Red Flags During Review

Reject or redesign a PR if it introduces any of these:

- JWT access tokens for browser MVP sessions.
- Microservice split for initial implementation.
- Kubernetes dependency for MVP.
- Direct readiness changes from AI confidence.
- Evidence approval inside task completion.
- Evidence mapping approval inside evidence approval without explicit reviewer action.
- Permanent public evidence URLs.
- `current_version_id` on `EvidenceItem`.
- Task status `APPROVED`.
- `OVERDUE` as an exclusive task status.
- Control readiness calculated from uploaded files instead of evidence requirements.
- Readiness calculated from informational controls.
- `company_id` from request body trusted as authorization.
- Role checks without tenant membership checks.
- Unscoped global ID lookup before tenant authorization.
- Destructive delete for compliance records without policy workflow.
- Audit log update/delete routes.
- Logs containing passwords, session tokens, CSRF tokens, signed URLs, storage keys, full evidence text, or sensitive AI payloads.

## Required Cross-Cutting Services

Create shared modules for:

```txt
auth/session service
csrf service
tenant context service
permission service
audit log service
storage service
idempotency service
error mapper
clock service
schema validation
```

Do not duplicate these rules inside feature controllers.

## Required State Transition Pattern

Every state-changing service should follow this shape:

```ts
async function transitionX(context, input) {
  const entity = await loadEntityInTenantScope(context, input.id);

  requirePermission(context, "permission.name", entity);

  assertCurrentState(entity.status, allowedFromStates);

  validateBusinessRules(input, entity);

  return prisma.$transaction(async (tx) => {
    const updated = await updateEntity(tx, entity, input);
    await audit(tx, context, "EVENT_CODE", updated);
    return updated;
  });
}
```

## Required API Route Metadata

Every route must declare:

- operation ID
- auth requirement
- permission predicate
- schemas
- success response
- error set
- idempotency rule
- concurrency rule
- audit event or explicit `none`
- rate limit policy where applicable

## Required Testing Shape

For every major feature:

- service unit tests
- route/integration tests
- RBAC tests
- cross-tenant tests
- business-rule failure tests
- audit-event tests
- frontend state tests where UI exists
