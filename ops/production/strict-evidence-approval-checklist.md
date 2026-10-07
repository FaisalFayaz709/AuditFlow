# Strict Production Evidence Approval Checklist

Status: `PENDING_HUMAN_EVIDENCE`

Use this checklist before changing `customerEvidenceAllowed` to `true`. It requires real evidence, not TODO placeholders, screenshots without context, or self-attestation only.

## Required areas

| Area | Required evidence | Reviewer | Evidence artifact | Decision |
|---|---|---|---|---|
| Security | independent threat review; cross-tenant/IDOR tests; CSRF tests; upload validation; dependency scanning; secret rotation procedure |  |  | PENDING |
| Files | private encrypted storage; malware scanning; object reconciliation; download authorization tests |  |  | PENDING |
| Recovery | managed backups/PITR; documented restore test; explicit RPO/RTO |  |  | PENDING |
| Observability | request IDs; structured redacted logs; error tracking; uptime checks; storage/database/worker alerts |  |  | PENDING |
| Privacy | retention/deletion terms; DPA/subprocessor inventory; AI provider data handling; incident notification process |  |  | PENDING |
| Performance | representative load test; typical list/detail API p95 target <= 500ms |  |  | PENDING |
| Accessibility | keyboard primary workflows; semantic forms/tables; non-color status cues |  |  | PENDING |
| Operations | staging environment; CI/CD evidence; migration/release checklist; incident runbooks; support escalation owner |  |  | PENDING |

## Approval rule

All area statuses must be `APPROVED`, every area must have a non-placeholder evidence reference, and the final manifest must include a real `approvalReference` before customer evidence may be enabled.

## Required commands

```bash
pnpm ci
pnpm gate:production-source
pnpm gate:production-strict
pnpm production:gate:verify
```

## Environment must remain blocked until approval

```text
CUSTOMER_EVIDENCE_ENABLED=false
PRODUCTION_GATE_STATUS=BLOCKED
```
