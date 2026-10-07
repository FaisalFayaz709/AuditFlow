# Notification Delivery Contract

Contract version: `notification-delivery-v1.0`

## Transaction boundary

Business transactions create notification records only. Provider delivery runs later through `DELIVER_NOTIFICATIONS` or worker processing. Delivery failure cannot roll back the business mutation that created the notification.

## Deduplication

Every event producer should provide an event-specific `dedup_key`, for example:

- `evidenceId + threshold + date window`
- `taskId + reminder type + date window`
- `reportId + ready`
- `auditorGrantId + granted`

## Retries

Retries use bounded exponential backoff controlled by:

- `NOTIFICATION_MAX_ATTEMPTS`
- `NOTIFICATION_BASE_BACKOFF_SECONDS`
- `NOTIFICATION_MAX_BACKOFF_SECONDS`
- `NOTIFICATION_DELIVERY_LOCK_SECONDS`

Each provider attempt writes a `notification_deliveries` record.

## Preferences

Users may reduce non-security categories:

- WORKFLOW
- REMINDER
- REPORT
- AI
- AUDITOR_ACCESS

Mandatory categories remain enabled:

- ACCOUNT_SECURITY
- INVITATION

## Sensitive content rule

Email contains minimal metadata and links back to authenticated AuditFlow. Restricted evidence and evidence files are never attached to notification email by default.
