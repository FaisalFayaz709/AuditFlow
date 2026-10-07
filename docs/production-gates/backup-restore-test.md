# Production Gate — Backup, Restore, RPO, and RTO Evidence

## Gate status

Status: `PENDING_HUMAN_EVIDENCE`

## Required recovery evidence

| Evidence item | Required detail | Value/evidence reference | Status |
|---|---|---|---|
| Managed backup/PITR | PostgreSQL backup/PITR enabled where available | TODO | PENDING |
| Object storage recovery | Bucket/versioning/lifecycle/backups documented as applicable | TODO | PENDING |
| Restore test | Restore performed from backup into isolated environment | TODO | PENDING |
| Data consistency check | Restored DB/object metadata consistency verified | TODO | PENDING |
| RPO | Explicit recovery point objective | TODO | PENDING |
| RTO | Explicit recovery time objective | TODO | PENDING |
| Restore event audit | `RESTORE_TEST_COMPLETED` or equivalent release evidence recorded | TODO | PENDING |

## Required command evidence

```bash
pnpm ci:operational-gates
```

## Approval

- Operations reviewer:
- Restore test date:
- Decision: `PENDING | APPROVED | REJECTED`
