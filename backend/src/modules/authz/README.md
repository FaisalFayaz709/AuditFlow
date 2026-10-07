# Pass 29 AuthZ Module

This module is the canonical authorization boundary for AuditFlow.

Rules:

- Every protected operation requires an active tenant membership plus a named permission predicate.
- Services load target records inside `company_id = tenant.companyId` scope before applying business rules.
- Foreign-tenant identifiers must behave as not found, not as leaked resource existence.
- Frontend visibility is only convenience. Backend authorization is authoritative.
- AUDITOR membership alone is not enough for selected evidence/report access; an active time-bounded grant must cover the scope.
- Route handlers and services must not duplicate ad hoc role comparisons when a named predicate exists.

The legacy `shared/permissions.ts` file only re-exports this module for old imports. New code imports from `modules/authz/*`.
