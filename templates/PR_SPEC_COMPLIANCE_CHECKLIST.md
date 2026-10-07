# Pull Request Spec Compliance Checklist

## Architecture

- [ ] Does not introduce microservices.
- [ ] Does not introduce Kubernetes as a requirement.
- [ ] Preserves Fastify modular-monolith structure.
- [ ] Preserves PostgreSQL as transactional source of truth.

## Authentication and Authorization

- [ ] Uses opaque server-side session pattern.
- [ ] Does not introduce browser JWT access tokens.
- [ ] Uses CSRF protection for state-changing requests.
- [ ] Loads target entity inside authorized tenant scope.
- [ ] Enforces active membership.
- [ ] Enforces named permission predicate.
- [ ] Includes cross-tenant test.

## Evidence and Readiness

- [ ] Does not overwrite approved evidence binaries.
- [ ] Uses `latest_version_id` and `current_approved_version_id`.
- [ ] Does not use `current_version_id`.
- [ ] Evidence approval and mapping approval remain separate.
- [ ] AI confidence does not affect readiness.
- [ ] Informational controls are excluded from readiness.
- [ ] Expired/superseded/archived evidence does not satisfy requirements.

## Tasks

- [ ] Uses `COMPLETED`, not task `APPROVED`.
- [ ] Task completion does not approve evidence.
- [ ] Overdue is derived, not exclusive status.

## API and Audit

- [ ] Route has request/response schemas.
- [ ] Route has documented error set.
- [ ] Important mutation writes audit event.
- [ ] Sensitive values are not logged or returned.
- [ ] Includes happy-path test.
- [ ] Includes authorization failure test.
- [ ] Includes business-rule failure test.

## AI

- [ ] AI output is schema-validated.
- [ ] AI is optional.
- [ ] AI creates suggestions only.
- [ ] AI cannot authorize or mutate business state directly.
- [ ] Prompt-injection behavior is considered where document text is involved.
