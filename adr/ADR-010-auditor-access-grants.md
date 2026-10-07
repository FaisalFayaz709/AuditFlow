# ADR-010: Auditor Access Grants

Status: Accepted

## Decision

Auditor access is controlled by explicit, time-bounded `AuditorAccessGrant` records.

## Scope Types

```txt
FRAMEWORK
CONTROL
EVIDENCE_ITEM
EVIDENCE_VERSION
REPORT
```

## Rules

- `starts_at` and `expires_at` are required.
- Default maximum access window is 90 days.
- `revoked_at` causes immediate revocation.
- Only approved evidence and approved/generated reports are visible unless explicitly permitted otherwise.
- Download may be disabled independently of view permission.
- Grant creation, sensitive download use, and revocation are audited.
