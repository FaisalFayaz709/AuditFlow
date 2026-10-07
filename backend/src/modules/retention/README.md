# Retention Module

Pass 34 completes the policy-controlled retention/deletion/legal-hold workflow.

Core rules:

- Archive first; permanent purge is never a direct destructive route.
- Purge requires request, authorization, separate approval, minimum waiting period, maintenance/background execution, and completion audit.
- Requester self-approval is blocked.
- Legal hold blocks request creation, approval, and execution.
- Backup-expiry limitations are disclosed and acknowledged before a deletion request can be created.
- Audit logs, reviews, task history, membership history, and actor snapshots are protected accountability records.

The canonical policy values live in `retention-policy.ts`.
