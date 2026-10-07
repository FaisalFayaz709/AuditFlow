# Production Gate — Operations, Release, Staging, and Support Evidence

## Gate status

Status: `PENDING_HUMAN_EVIDENCE`

## Required operations evidence

| Area | Required proof | Evidence reference | Status |
|---|---|---|---|
| Staging environment | Staging is production-like for cookies/CORS/TLS, DB, storage, scanner, and email sandbox | TODO | PENDING |
| CI/CD | CI pipeline evidence includes format, lint, typecheck, tests, build, dependency scan, migration validation, smoke | TODO | PENDING |
| Migration/release checklist | Controlled migration and release checklist completed | TODO | PENDING |
| Rollback/forward fix | Application rollback and DB forward-fix policy understood | TODO | PENDING |
| Incident runbooks | Required incident categories documented | See `docs/production-gates/incident-runbooks.md` | PENDING |
| Support escalation owner | Owner and escalation route assigned | TODO | PENDING |

## Required commands/results to attach

```bash
pnpm ci
pnpm gate:production-source
pnpm gate:production-strict
```

`gate:production-strict` is expected to fail until the evidence pack is completed and approved.
