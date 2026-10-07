# Backup and Restore Runbook

## PostgreSQL

- Managed daily backups are the minimum.
- Production should prefer PITR where available.
- A documented restore test is required before customer launch.
- Production migrations are immutable after application.

## Evidence objects

- Use private encrypted storage.
- Enable provider versioning or backup strategy where feasible.
- Verify database/object references remain consistent after restore.

## Secrets

- Store only in the platform secret manager.
- Maintain documented rotation and emergency recovery procedure.
- Never copy production secrets into repository, logs, screenshots, or support tickets.

## Reports

- Reports should be regenerable from primary data where practical.
- Report object retention may be shorter than evidence retention.

## Restore test output

Each restore test must produce a record using `ops/backup/restore-test-record-template.md` and record the `RESTORE_TEST_COMPLETED` audit event when a production-equivalent restore validation is completed.
