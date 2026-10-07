# ADR-011: Retention, Deletion, and Legal Hold

Status: Accepted

## Decision

Archive first. Permanent purge requires a policy-controlled workflow.

## Default Rules

- Approved/rejected/superseded evidence is retained until company policy permits purge.
- Audit logs are retained at least as long as related business records.
- Temporary uploads are purged after expiration if not finalized.
- Generated reports may have shorter retention.
- AI analyses are retained with evidence version unless policy allows shorter retention.
- Deletion propagation through backups is limited by backup expiration and must be disclosed.

## Permanent Purge Workflow

```txt
deletion requested
authorization checked
approval recorded
waiting period observed
background job executes purge
completion audit event written
```

## Legal Hold

Legal hold prevents purge but does not grant broader access.

## Historical Accountability

User removal must not erase historical actor attribution. Use immutable actor snapshots where necessary.
