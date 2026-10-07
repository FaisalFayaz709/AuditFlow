# Production Environment Matrix

| Environment | Minimum configuration |
|---|---|
| Local | Docker PostgreSQL, local filesystem or MinIO-compatible storage, fake email, mocked AI by default. |
| Test | Disposable PostgreSQL, fake object storage, mocked clock/email/AI, deterministic seeds. |
| Staging | Managed PostgreSQL, private object storage, sandbox email, production-like cookie/CORS/TLS, optional real AI test account. |
| Production | Managed PostgreSQL with PITR where available, private encrypted storage, secret manager, monitoring, backup tests, malware scanning, controlled migrations, incident runbooks. |

## Production must not use

- Local-only session pepper.
- Local file storage for real customer evidence.
- `SECURITY_SCAN_MODE=disabled_non_production`.
- Wildcard CORS with credentials.
- Debug logging of sensitive evidence/AI content.
- Unverified database migrations.
- Unverified backup/restore strategy.
