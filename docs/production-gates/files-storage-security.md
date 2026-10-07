# Production Gate — Files, Storage, Malware Scan, and Download Authorization

## Gate status

Status: `PENDING_HUMAN_EVIDENCE`

## Required evidence

| Area | Required proof | Evidence reference | Status |
|---|---|---|---|
| Private encrypted storage | Production storage uses S3/R2/MinIO-compatible private bucket with encryption configuration | TODO | PENDING |
| Malware scanning | Staging/production uses required real malware scanning, not fake scanner or bypass | TODO | PENDING |
| Quarantine/rejection | `QUARANTINED` and `SECURITY_REJECTED` binaries are not downloadable through normal routes | TODO | PENDING |
| Object reconciliation | Temporary-object cleanup and finalization retry paths were tested | TODO | PENDING |
| Download authorization | Every download goes through backend authorization and short-lived signed access only | TODO | PENDING |
| Sensitive data logging | Storage keys, signed URLs, checksums where sensitive, evidence text, and tokens are not logged | TODO | PENDING |

## Required commands/results to attach

```bash
pnpm verify:25
pnpm verify:26
pnpm verify:27
pnpm --filter @auditflow/backend test -- test/production-object-storage-policy.test.ts test/security-scan-policy.test.ts test/storage-reconciliation-policy.test.ts
```

## Locked behavior

- No permanent public evidence URL is permitted.
- Evidence approval requires `security_scan_status = CLEAN` except explicit local/test bypass.
- Production customer evidence remains blocked unless the production gate is approved.
