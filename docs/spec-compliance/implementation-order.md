# Implementation Order

Purpose: prevent new feature work from hiding unresolved product-specification gaps.

## Always enforced

Every change must preserve:

- normative v2.1 priority,
- modular monolith architecture,
- locked stack,
- opaque browser sessions,
- tenant membership plus exact permission predicate,
- private evidence access,
- human approval for evidence and mappings,
- deterministic readiness based on evidence coverage,
- no certification or automatic-compliance claims.

## Required order

1. Database and tenant-boundary foundation.
2. API contract completion.
3. Framework and control reconciliation.
4. Storage, scanning, and upload finalization.
5. Concurrency, authorization, and auditor access hardening.
6. Reports, readiness trace, task semantics, and UI completion states.
7. Retention, notifications, and AI safety checks.
8. Frontend accessibility, CI/CD, and production non-functional evidence.
9. Final release acceptance with traceable readiness evidence.

## Stop-work rule

If a specification violation is found, stop feature work and create a corrective task. Do not document an exception unless the source specification explicitly permits it.
