# Deployment Runbook

## Staging smoke path

1. Build backend and frontend.
2. Run `pnpm db:validate` and `pnpm ci:migration-validate`.
3. Apply Prisma migrations against staging database after backup verification.
4. Start backend with production-like cookie/CORS/TLS settings.
5. Confirm `/health` returns 200 and includes release ID and commit SHA.
6. Confirm `/ready` returns 200 and includes database readiness.
7. Register/login with a staging user.
8. Enable starter framework.
9. Upload a safe test evidence file.
10. Approve evidence and mapping.
11. Confirm readiness calculation changes and readiness trace explains the result.
12. Generate and download a JSON or CSV report.
13. Create an auditor grant and confirm selected read-only access only.
14. Confirm audit log entries exist.
15. Store the release audit record.

## Deployment options

The MVP can use managed frontend hosting plus Node backend hosting, managed PostgreSQL, private object storage, and Redis when jobs are enabled.

## Operational boot gates

Staging/production boot must fail when any of these are missing or unsafe:

- HTTPS deployed `FRONTEND_ORIGIN`.
- Non-default `SESSION_PEPPER`.
- Private object storage driver: `s3`, `r2`, or `minio`.
- Required real malware scanner.
- Database SSL requirement.
- Production database PITR confirmation.
- Managed/platform secret store.
- Structured JSON logging.
- Deployment-specific release ID and commit SHA.
- Restore-test proof before customer evidence.

## Forbidden deployment changes

- Do not split the MVP into distributed services.
- Do not introduce Kubernetes as a required platform.
- Do not introduce another transactional database.
- Do not bypass backend authorization for downloads.
