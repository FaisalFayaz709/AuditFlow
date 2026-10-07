# Storage module

Pass 25 replaces the local-only evidence storage scaffold with a provider adapter that keeps AuditFlow a modular monolith while supporting private production object storage.

Supported drivers:

- `local` for development and tests only.
- `s3` for AWS S3-compatible private buckets.
- `r2` for Cloudflare R2 private buckets.
- `minio` for MinIO or other S3-compatible private buckets.

Rules enforced by this module:

- Evidence object keys are normalized and cannot escape the storage namespace.
- Evidence downloads still go through backend authorization; storage keys are not API contracts.
- Direct access URLs, when used, must be short-lived and are optional.
- Production cannot boot with `STORAGE_DRIVER=local`.
- S3/R2/MinIO drivers require bucket and credential configuration.
