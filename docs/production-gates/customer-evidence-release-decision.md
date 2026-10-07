# Customer Evidence Release Decision

Status: `BLOCKED`

is the strict production non-functional evidence gate. It does not manufacture approval. Customer evidence remains disabled until accountable reviewers replace every pending/TODO evidence item with real staging or production-like evidence and the strict command passes.

## Required decision fields

| Field | Required value before enabling customer evidence | Current value |
|---|---|---|
| `gateStatus` | `APPROVED` | `PENDING_HUMAN_EVIDENCE` |
| `customerEvidenceAllowed` | `true` only after approval | `false` |
| `approvalReference` | Real approval/change/security reference | `null` |
| Area approvals | All eight required areas approved | Pending |
| Evidence references | Non-placeholder evidence artifacts for every area | Pending |

## Non-negotiable command

```bash
pnpm gate:production-strict
```

If that command fails, customer evidence must remain blocked.

## Environment lock

```text
CUSTOMER_EVIDENCE_ENABLED=false
PRODUCTION_GATE_STATUS=BLOCKED
PRODUCTION_GATE_APPROVAL_REFERENCE=
```

## Approval record

- Final approver:
- Approval reference:
- Approval date:
- Evidence bundle location:
- Decision: `PENDING | APPROVED | REJECTED`
