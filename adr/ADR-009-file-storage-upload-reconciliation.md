# ADR-009: File Storage, Upload, and Reconciliation

Status: Accepted

## Decision

Use private object storage for binaries and PostgreSQL for metadata and authorization context.

## Upload Flow

```txt
authenticate and authorize tenant upload
create upload intent with generated object key
write to temporary private object
validate size, MIME, signature, checksum, security policy
create EvidenceItem/EvidenceVersion metadata in transaction
move/copy/mark final immutable object
set object_finalized_at
emit EVIDENCE_UPLOADED
enqueue extraction/AI after finalization
cleanup orphan temporary objects
```

## Rules

- Never trust user filenames for storage paths.
- Never expose permanent public URLs.
- Never expose secret storage keys.
- Downloads require authorization.
- Sensitive downloads may be audited.
- If DB commit fails after object upload, cleanup removes temporary object.
- If final object operation fails after DB commit, mark reconciliation failure and retry finalization.
