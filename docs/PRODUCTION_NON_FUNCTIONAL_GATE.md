# Production Non-Functional Gate

The production gate protects customers and evidence data. It is a real evidence gate, not a source-only checklist.

## Required evidence areas

- Security review: threat review, cross-tenant/IDOR checks, CSRF checks, upload validation, dependency scanning, and secret rotation.
- File storage security: private encrypted storage, malware scanning, object reconciliation, and download authorization.
- Recovery: managed backups/PITR, restore test, RPO, and RTO.
- Observability: request IDs, structured redacted logs, error tracking, uptime checks, and alerts.
- Privacy and AI provider handling: retention/deletion terms, DPA/subprocessor review, AI provider data handling, and incident notification process.
- Performance: representative load test with documented p95 targets.
- Accessibility: keyboard workflows, semantic forms/tables, and non-color status cues.
- Operations: staging environment, CI/CD evidence, migration/release checklist, incident runbooks, and support escalation owner.

## Source artifacts

The active source artifacts live under `docs/production-gates/` and `ops/production/`.

## Approval rule

Customer evidence remains disabled until every required evidence area is approved, the production gate manifest records a real approval reference, and the controlled release workflow succeeds in the target environment.
