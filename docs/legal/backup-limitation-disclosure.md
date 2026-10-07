# Backup Limitation Disclosure

Permanent purge removes active application content through the approved deletion workflow. Copies may remain in backups until those backups expire under the configured retention policy.

This disclosure must be visible before a user requests purge and must be acknowledged by the request body using `backupLimitationAcknowledged: true`.
