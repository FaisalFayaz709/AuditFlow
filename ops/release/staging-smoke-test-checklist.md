# Staging Smoke Test Checklist

This checklist is executed after a staging or production-like preview deployment. It does not replace automated tests; it proves the deployed artifact is reachable and the critical AuditFlow workflow still works.

## Required checks

1. Confirm `/health` returns service name, version, release ID, and commit SHA.
2. Confirm `/ready` returns database readiness and any enabled Redis/worker readiness.
3. Register/login with a staging user using the opaque server-side session cookie flow.
4. Confirm CSRF-protected state-changing requests succeed only with a valid CSRF token.
5. Enable framework for a company.
6. Create or review framework upgrade reconciliation if an upgrade scenario is included.
7. Upload evidence through staged private upload.
8. Confirm malware/security scan policy marks the safe test file as clean or reviewable.
9. Approve evidence as an authorized reviewer.
10. Approve mapping to a required evidence requirement.
11. Confirm dashboard readiness changes and open the readiness trace.
12. Generate report and confirm readiness/evidence language is used.
13. Create auditor grant and verify selected auditor access only.
14. Confirm audit log entries exist for the important mutations.
15. Confirm restricted evidence is never emailed, exposed as `storage_key`, or exposed through a long-lived object URL.

## Required result

Record PASS/FAIL, release ID, commit SHA, operator, timestamp, and any deviations in `ops/release/release-audit-record-template.md` or the environment-specific release record.
