# Retention, Deletion, Legal Hold, and Purge Policy

Policy version: `retention-purge-v1.0`.

AuditFlow uses archive-first deletion. Permanent purge is not a direct user action. It requires a deletion request, authorization, separate approval, minimum waiting period, background or maintenance execution, and audit completion.

## Backup limitation disclosure

Permanent purge removes active application content through the approved deletion workflow, but deletion propagates to backups only as backups expire under the configured retention policy.

## Legal hold

An active legal hold blocks purge. A company-wide legal hold blocks all purge execution for that company. An entity-specific hold blocks purge for the matching entity.

## Protected accountability records

The purge workflow must not erase audit logs, reviews, approvals, task history, membership history, or actor snapshots. These records preserve historical accountability and traceability.

## Supported purge targets

- Evidence item
- Report
- AI analysis

Other entity types require an explicit future policy extension and must not be added by ad hoc route logic.
