# Customer Evidence Enablement Runbook

Status: `BLOCKED_UNTIL_STRICT_PRODUCTION_GATE_APPROVAL`

This runbook is only used after all production non-functional evidence areas have been approved.

## Preconditions

1. `pnpm ci` passes against the release commit.
2. `pnpm gate:production-strict` passes.
3. Security, files, recovery, observability, privacy, performance, accessibility, and operations evidence are approved.
4. The production gate manifest has `gateStatus: APPROVED` and a real `approvalReference`.
5. The support escalation owner and incident commander are assigned.

## Enablement sequence

1. Record the approval reference in the release audit record.
2. Set `PRODUCTION_GATE_STATUS=APPROVED`.
3. Set `PRODUCTION_GATE_APPROVAL_REFERENCE` to the approved reference.
4. Set `CUSTOMER_EVIDENCE_ENABLED=true` only after the above values are live.
5. Run health/readiness checks and critical workflow smoke tests.
6. Record the final release audit event.

## Rollback

If any critical production gate evidence is invalidated, immediately set:

```text
CUSTOMER_EVIDENCE_ENABLED=false
PRODUCTION_GATE_STATUS=BLOCKED
```

Then follow the relevant incident runbook.
