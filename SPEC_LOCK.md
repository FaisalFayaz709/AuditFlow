# AuditFlow Specification Lock

Status: **Locked for initial implementation**  
Project: **AuditFlow — AI Compliance Evidence Manager**  
Specification basis: **AuditFlow Complete Software Specification v2.1, Gap Closure and Production-Readiness Edition**

## 1. Normative Order

The v2.1 addendum is normative over v2.0 wherever there is a conflict. Unchanged v2.0 requirements remain authoritative.

Implementation rule:

```txt
v2.1 explicit rule > v2.0 wording > engineering preference
```

No engineer may replace a v2.1 rule with a convenience implementation.

## 2. Product Boundary

AuditFlow manages compliance readiness evidence. It does **not** certify SOC 2, ISO 27001, GDPR, legal compliance, regulatory compliance, or audit success.

The product language must use:

- readiness
- evidence coverage
- control coverage
- missing evidence
- audit preparation
- review status

The product language must not use:

- certified
- legal-compliance guarantee language
- auditor replacement
- automatic compliance
- guaranteed pass

## 3. Architecture Lock

AuditFlow is a **modular monolith** for the initial implementation.

Allowed:

- one Fastify backend application
- internal modules
- one PostgreSQL transactional source of truth
- Prisma migrations
- private object storage for binaries
- React + TypeScript + Vite frontend
- optional worker later for slow jobs

Not allowed in the initial implementation:

- microservices
- Kubernetes requirement
- multiple databases per module
- distributed transactions
- Kafka/event-streaming-first architecture
- complex custom permission DSL
- autonomous AI agents

## 4. Stack Lock

| Layer | Locked Decision |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Fastify + TypeScript |
| Database | PostgreSQL |
| ORM / migrations | Prisma |
| Auth | Opaque server-side session token in HttpOnly cookie |
| File storage | Private local dev storage; S3/R2/MinIO-compatible object storage later |
| AI | Provider adapter + structured JSON output + human review |
| Background jobs | BullMQ + Redis after core workflow, not first |
| Testing | Vitest/Jest + Supertest + Playwright |
| Deployment | Managed frontend + Node backend + managed PostgreSQL + private object storage |

## 5. Browser Authentication Lock

Browser authentication uses opaque random server-side sessions.

Required behavior:

- cookie name: `auditflow_session`
- token is cryptographically random
- raw token is never stored in the database
- database stores `SHA-256(token + server_pepper)`
- cookie is HttpOnly
- cookie is Secure in staging/production
- SameSite=Lax by default
- CSRF token is independent from authentication cookie
- password reset revokes active user sessions
- changing role/removing membership takes effect on the next request

JWT access tokens are not used in the browser MVP. JWT may be introduced later only for service-to-service or API-client needs.

## 6. Tenant Isolation Lock

Every company-owned query must derive company scope from an authenticated active `CompanyMember`.

Never trust these as sufficient authorization:

- `company_id` in request body
- `companyId` in frontend state
- cookie claims
- guessed foreign IDs
- route parameters alone

Required helper patterns:

```ts
requireAuthenticatedUser()
requireCompanyMembership(userId, companyId)
requirePermission(context, action)
loadEntityInTenantScope(...)
```

A globally valid foreign ID must behave as not found or unauthorized without leaking cross-tenant existence.

## 7. RBAC Lock

Role alone is never enough. Every protected operation requires:

```txt
active tenant membership + exact permission predicate + resource ownership/scope predicate
```

Canonical roles:

- `OWNER`
- `ADMIN`
- `COMPLIANCE_MANAGER`
- `MEMBER`
- `AUDITOR`

Routes must use centralized named permission predicates. Do not duplicate ad hoc role comparisons inside controllers.

## 8. Readiness Lock

Readiness is calculated from approved valid evidence and approved mappings only.

Eligible controls:

```txt
company_control.applicability = APPLICABLE
AND control.control_type = EVIDENCE_BASED
```

Readiness formula:

```txt
readiness = 100 * sum(coverage(control) * risk_weight(control)) / sum(risk_weight(control))
```

Where:

```txt
coverage(control) = satisfied_required_requirements / required_requirements
risk_weight = CRITICAL:4, HIGH:3, MEDIUM:2, LOW:1
```

A requirement is satisfied only when at least one mapping exists where:

- `EvidenceVersion.status = APPROVED`
- `EvidenceControlMapping.status = APPROVED`
- evidence is not expired
- evidence is not superseded
- evidence is not archived
- evidence is security-cleared where required

If no eligible controls exist:

```txt
readinessPercent = null
readinessStatus = NOT_CALCULABLE
```

AI confidence never affects readiness.

## 9. Control Type Lock

Canonical control types:

```ts
ControlType = EVIDENCE_BASED | INFORMATIONAL
```

Rules:

- `EVIDENCE_BASED` controls must have at least one required evidence requirement before framework publication.
- `INFORMATIONAL` controls may have zero required requirements.
- `INFORMATIONAL` controls are excluded from readiness numerator and denominator.
- Optional requirements are visible as advisory gaps but do not reduce readiness.

## 10. Evidence Version Lifecycle Lock

Canonical evidence version statuses:

```ts
UPLOADED
QUARANTINED
SECURITY_REJECTED
PROCESSING
PROCESSING_FAILED
NEEDS_REVIEW
APPROVED
REJECTED
EXPIRED
SUPERSEDED
ARCHIVED
```

Rules:

- approved binaries are immutable
- approved evidence is never overwritten
- replacement creates a new `EvidenceVersion`
- `SECURITY_REJECTED` binary is never exposed through normal download routes
- approval requires malware/security status `CLEAN`, except allowed non-production bypass
- expiry is logically enforced during readiness calculation even if a scheduled job is delayed

## 11. Evidence Item Pointer Lock

Use:

```ts
latest_version_id
current_approved_version_id
```

Do not introduce:

```ts
current_version_id
```

Rules:

- uploading v2 changes `latest_version_id`
- v1 remains `current_approved_version_id` until v2 is approved
- approving v2 atomically sets `current_approved_version_id = v2` and marks v1 `SUPERSEDED`
- rejecting/archiving v2 does not disturb v1
- readiness evaluates valid approved versions and mappings; pointer is a UX optimization, not sole source of truth

## 12. Task Lifecycle Lock

Canonical task statuses:

```ts
TODO
IN_PROGRESS
SUBMITTED
COMPLETED
REJECTED
CANCELLED
```

Use `COMPLETED`, not `APPROVED`, to avoid implying evidence approval.

Derived overdue:

```ts
overdue = due_date < now && status NOT IN (COMPLETED, CANCELLED)
```

Task completion never approves evidence or mappings.

## 13. AI Lock

AI is optional, advisory, structured, provenance-tracked, and human-in-the-loop.

AI may:

- summarize uploaded evidence
- classify document type
- suggest mappings
- identify missing information
- provide advisory confidence
- create draft auditor-facing summaries

AI must never:

- approve evidence
- approve mappings
- approve control applicability
- set readiness
- claim legal compliance
- create controls
- invent missing evidence, dates, owners, approvals, or unsupported facts
- follow instructions embedded inside evidence documents
- override authorization or tenant boundaries

## 14. File Storage Lock

Binaries are private objects. PostgreSQL stores metadata and storage references.

Required upload pattern:

```txt
authenticate + authorize
create upload intent
write temporary private object
validate size/MIME/signature/checksum/security policy
finalize DB transaction
move/copy/mark final immutable object
set object_finalized_at
emit audit event
enqueue extraction/AI only after finalization
cleanup orphaned temporary objects
```

Never expose permanent public URLs or secret storage keys.

## 15. Auditor Access Lock

Auditor access requires explicit time-bounded grants.

Canonical scopes:

```ts
FRAMEWORK
CONTROL
EVIDENCE_ITEM
EVIDENCE_VERSION
REPORT
```

Rules:

- auditor grants have `starts_at` and `expires_at`
- default maximum access window is 90 days
- revocation is immediate
- auditor access is read-only unless explicitly permitted by future spec
- grant creation, sensitive download use, and revocation are audited

## 16. Deletion and Retention Lock

Archive first. Permanent purge is policy-controlled.

Required purge workflow:

```txt
deletion request
authorization
approval
waiting period
background execution
completion audit event
backup limitation disclosure
```

User removal must not erase historical actor attribution.

## 17. Implementation Ordering Lock

Core correctness comes before AI and advanced infrastructure.

Build order:

```txt
1. Spec lock and ADRs
2. Project skeleton, PostgreSQL, migrations, request IDs, standardized errors
3. Opaque sessions, CSRF, membership context, RBAC, audit events
4. Framework families/versions, controls, evidence requirements
5. Secure staged upload, immutable evidence versions, review, download auth
6. Manual mappings and readiness calculation
7. Tasks, comments, dashboard metrics, basic reports
8. Frontend completion states, accessibility, cross-tenant/RBAC tests
9. Deployment, backups, observability
10. Only then: extraction, AI, jobs, reminders, PDF reports, auditor grants, integrations
```

## 18. Universal Definition of Done

A feature is not done unless:

- business rule lives in service/domain layer
- request/response schema exists
- tenant membership and exact permission predicate are enforced
- state transition validates current state
- concurrency precondition is handled where relevant
- important mutation writes audit event
- UI covers loading, empty, success, validation, unauthorized, and failure states
- sensitive fields are excluded from logs and unintended responses
- tests include happy path, authorization failure, business-rule failure, and cross-tenant attempt
- docs, migrations, seed data, and known limitations are updated
