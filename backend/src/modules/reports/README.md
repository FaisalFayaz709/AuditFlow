# Reports Module — Pass 31

The reports module now has explicit versioned v1 report schemas for the four canonical AuditFlow reports:

- `AUDIT_READINESS`
- `MISSING_EVIDENCE`
- `CONTROL_COVERAGE`
- `EVIDENCE_INVENTORY`

Each report persists the exact generation parameters, active framework enrollment/version where applicable, `schemaVersion`, calculated timestamp, generated artifact metadata, and stable JSON/CSV field names. Reports use readiness/evidence coverage language only and never represent legal, regulatory, SOC 2, ISO 27001, GDPR, or other compliance certification.

## v1 schema files

```text
backend/src/modules/reports/schemas/audit-readiness.v1.ts
backend/src/modules/reports/schemas/missing-evidence.v1.ts
backend/src/modules/reports/schemas/control-coverage.v1.ts
backend/src/modules/reports/schemas/evidence-inventory.v1.ts
```

## Contract fixes in Pass 31

- `AUDIT_READINESS` now includes `targetAuditDate`, readiness status/percent, control coverage, owners, missing requirements, expiring evidence, and open tasks.
- `MISSING_EVIDENCE` now includes task status and task due date for each missing requirement row.
- `CONTROL_COVERAGE` now includes approved evidence references for each control.
- `EVIDENCE_INVENTORY` now groups dates and includes item/version IDs, status, sensitivity, mappings, uploader/reviewer, checksum, and a non-secret storage reference.
- CSV headers are explicitly versioned and stable within schema v1.
- Evidence storage keys remain excluded from report bodies, CSV exports, API responses, and logs.

PDF reports remain deferred until after the core correctness and schema-stability gates remain green.
