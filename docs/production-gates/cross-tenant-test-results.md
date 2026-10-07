# Production Gate — Cross-Tenant, IDOR, and CSRF Test Results

## Gate status

Status: `PENDING_HUMAN_EVIDENCE`

## Required test matrix

| Area | Required tests | Evidence reference | Status |
|---|---|---|---|
| Company/member isolation | A member of company A cannot read/update company B resources | TODO | PENDING |
| Evidence isolation | Evidence item/version IDs from another tenant return not found or equivalent non-leaking denial | TODO | PENDING |
| Task isolation | Assigned-member access works only inside the active tenant | TODO | PENDING |
| Report isolation | Report download and metadata access remain tenant-scoped | TODO | PENDING |
| Auditor grants | Auditor access requires active, unexpired, unrevoked grant for the selected scope | TODO | PENDING |
| CSRF | Mutations reject missing, stale, invalid, or cross-site CSRF token | TODO | PENDING |
| Role changes | Removed/disabled membership loses access on the next request | TODO | PENDING |

## Evidence commands to attach

```bash
pnpm test:security
pnpm --filter @auditflow/backend test -- test/authz-cross-tenant-policy.test.ts test/tenant-boundary.test.ts test/security-route-contracts.test.ts
pnpm --filter @auditflow/backend test -- test/cookies.test.ts
```

## Expected acceptance

- No test may be accepted with known cross-tenant leakage.
- Any externally visible object identifier must be loaded inside the active tenant scope.
- Frontend visibility is not accepted as authorization proof.
