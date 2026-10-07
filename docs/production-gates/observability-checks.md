# Production Gate — Observability and Alerting Evidence

## Gate status

Status: `PENDING_HUMAN_EVIDENCE`

## Required observability checks

| Control | Required proof | Evidence reference | Status |
|---|---|---|---|
| Request IDs | Request ID exists in request/response flow and logs | TODO | PENDING |
| Structured redacted logs | Logs are JSON-formatted and redact tokens, storage keys, signed URLs, and evidence text | TODO | PENDING |
| Error tracking | Error tracking DSN or platform integration configured for staging/production | TODO | PENDING |
| Uptime checks | `/health` and `/ready` monitored | TODO | PENDING |
| Database alerts | DB connectivity/capacity/failure alerts configured | TODO | PENDING |
| Storage alerts | Object storage failure/error alerts configured | TODO | PENDING |
| Worker alerts | Background job queue/worker failure alerts configured | TODO | PENDING |

## Required commands/results to attach

```bash
pnpm ci:operational-gates
pnpm ci:staging-smoke-contract
```

## Notes

No sensitive evidence text or storage secret should appear in screenshots, logs, support tickets, or release records.
