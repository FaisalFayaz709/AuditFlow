# ADR-007: Task Completion Does Not Approve Evidence

Status: Accepted

## Decision

Use task status `COMPLETED`, not `APPROVED`.

Canonical task statuses:

```txt
TODO
IN_PROGRESS
SUBMITTED
COMPLETED
REJECTED
CANCELLED
```

## Rule

Task completion means the requested submission was accepted as complete. It does not approve:

- evidence version
- evidence mapping
- control readiness
- compliance state

## Derived Overdue

```ts
overdue = due_date < now && status NOT IN (COMPLETED, CANCELLED)
```

## UI Requirement

Show separate badges for:

- Task complete
- Evidence review
- Mapping review
