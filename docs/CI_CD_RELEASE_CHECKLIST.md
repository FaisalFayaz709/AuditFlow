# CI/CD Release Checklist

This checklist defines the active product CI and controlled-release expectations. It intentionally does not depend on historical pass archives or generated handoff evidence.

## Pull request / main branch CI

Required checks:

1. Install dependencies with pnpm.
2. Validate Prisma schema and generate Prisma client.
3. Generate OpenAPI contract.
4. Run format check.
5. Run lint.
6. Run TypeScript checks.
7. Run unit and contract tests.
8. Run security/RBAC tests.
9. Build backend and frontend.
10. Run dependency scan.
11. Validate migration diff.
12. Verify release-readiness source artifacts.
13. Verify staging smoke contract.
14. Run Playwright critical workflow smoke where browser dependencies are available.

## Controlled release

Required sequence:

1. Approved change reference recorded.
2. Reproducible dependency install completed from committed lockfile.
3. Production non-functional gate checked.
4. Backup/PITR and latest restore test verified.
5. Prisma migrations validated and applied through the approved procedure.
6. Backend deployed with release ID and commit SHA.
7. `/health` and `/ready` checks passed.
8. Frontend deployed after backend readiness.
9. Critical workflow smoke test executed.
10. Release audit record stored.

## Customer evidence enablement

`CUSTOMER_EVIDENCE_ENABLED=true` is allowed only after production gate evidence is approved, release-owner approval is recorded, and the target environment passes the controlled release sequence.
