# Production Gate — Security Review Evidence

## Gate status

Status: `PENDING_HUMAN_EVIDENCE`

This document is the accountable evidence record for the security portion of the production non-functional gate. It must be completed with real staging/production-like results before `PRODUCTION_GATE_STATUS=APPROVED` is allowed.

## Required evidence

| Evidence item | Required result | Evidence reference | Reviewer | Status |
|---|---|---|---|---|
| Independent threat review | Review completed by a reviewer not responsible for the feature implementation | TODO | TODO | PENDING |
| Cross-tenant/IDOR test evidence | No cross-tenant data disclosure; foreign-tenant IDs behave as not found | See `docs/production-gates/cross-tenant-test-results.md` | TODO | PENDING |
| CSRF test evidence | State-changing browser requests reject missing/invalid CSRF tokens | TODO | TODO | PENDING |
| Upload validation evidence | Size, MIME signature, checksum, malware/security scan, quarantine, finalization, and cleanup verified | TODO | TODO | PENDING |
| Dependency scan evidence | Dependency scan completed and accepted; exceptions documented with owner/date | TODO | TODO | PENDING |
| Secret rotation evidence | Secret rotation procedure tested or dry-run accepted | TODO | TODO | PENDING |

## Locked-spec security criteria

- Authentication remains opaque server-side sessions in an HttpOnly cookie.
- Browser JWT access-token authentication is not introduced.
- Backend authorization remains authoritative.
- Every protected operation combines active tenant membership with exact permission predicate.
- Evidence storage keys and sensitive tokens are excluded from logs and unintended responses.
- AI output remains advisory and cannot perform approval state changes.

## Approval

This section must be completed by accountable humans before strict gate approval.

- Security reviewer:
- Date:
- Decision: `PENDING | APPROVED | REJECTED`
- Notes:
