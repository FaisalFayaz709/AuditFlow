# ADR-006: Evidence Versioning and Lifecycle

Status: Accepted

## Decision

Separate logical evidence identity from immutable uploaded versions.

- `EvidenceItem` = logical document concept.
- `EvidenceVersion` = immutable binary/version.

## Canonical Statuses

```txt
UPLOADED
QUARANTINED
SECURITY_REJECTED
PROCESSING
PROCESSING_FAILED
NEEDS_REVIEW
APPROVED
REJECTED
EXPIRED
SUPERSEDED
ARCHIVED
```

## Pointer Rule

Use:

```txt
latest_version_id
current_approved_version_id
```

Do not use:

```txt
current_version_id
```

## Replacement Rule

- Uploading a new version updates `latest_version_id`.
- Existing approved version remains current until replacement is approved.
- Approving replacement atomically marks old version `SUPERSEDED` and sets new `current_approved_version_id`.
- Rejecting or archiving a replacement does not disturb the old approved version.

## Security Rule

`SECURITY_REJECTED` binaries are never downloadable through normal routes.
