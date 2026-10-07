# Customer Evidence Gate Record

Gate status: **BLOCKED**

This record must be completed before `CUSTOMER_EVIDENCE_ENABLED=true` and `PRODUCTION_GATE_STATUS=APPROVED` are used in production.

## Required production configuration

- `NODE_ENV=production`
- `SECURITY_SCAN_MODE=required`
- `CUSTOMER_EVIDENCE_ENABLED=true`
- `PRODUCTION_GATE_STATUS=APPROVED`
- `PRODUCTION_GATE_APPROVAL_REFERENCE=<this signed record or ticket>`
- private encrypted object storage configured
- managed PostgreSQL backups/PITR configured where available
- Redis/worker configured if asynchronous jobs are enabled

## Gate checklist

| Gate | Evidence location | Status | Approver |
|---|---|---:|---|
| Security threat review | `ops/security/threat-review-template.md` | BLOCKED | |
| Dependency scan | `ops/security/dependency-scan-policy.md` | BLOCKED | |
| Secret rotation | `ops/security/secret-rotation-procedure.md` | BLOCKED | |
| File storage/malware/reconciliation | `docs/PRODUCTION_NON_FUNCTIONAL_GATE.md` | BLOCKED | |
| Backup restore test | `ops/backup/restore-test-record-template.md` | BLOCKED | |
| RPO/RTO | `docs/PRODUCTION_NON_FUNCTIONAL_GATE.md` | BLOCKED | |
| Observability/alerts | `ops/monitoring/alert-rules.md` | BLOCKED | |
| Privacy/DPA/subprocessors | `ops/privacy/privacy-dpa-subprocessor-checklist.md` | BLOCKED | |
| AI provider data handling | `ops/privacy/ai-provider-data-handling-record.md` | BLOCKED | |
| Incident notification assessment | `ops/privacy/incident-notification-assessment.md` | BLOCKED | |
| Load test | `ops/performance/load-test-plan.md` | BLOCKED | |
| Accessibility audit | `ops/accessibility/accessibility-audit-checklist.md` | BLOCKED | |
| Support escalation owner | `ops/support/support-escalation-owner.md` | BLOCKED | |

## Final approval

- Final decision: BLOCKED / APPROVED
- Approval reference:
- Final approver name:
- Final approver role:
- Approval timestamp:
- Conditions/limitations:

## Important limitation

Deletion from backups propagates only as backups expire. This limitation must be disclosed in customer-facing retention/deletion terms before customer launch.
