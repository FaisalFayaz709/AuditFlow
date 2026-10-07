# Release Audit Record Template

## Release identity

- Environment:
- Release ID:
- Commit SHA:
- Operator:
- Approval reference:
- Strict production gate approval reference:
- Started at:
- Completed at:

## Required production release sequence

- [ ] `approved_change` — approved change reference recorded.
- [ ] `strict_production_gate` — `pnpm gate:production-strict` passed before customer-evidence release.
- [ ] `backup_verification` — managed backup/PITR and latest restore test verified before migration.
- [ ] `controlled_migration` — Prisma migration validation and controlled release procedure completed.
- [ ] `backend_deploy` — backend deployed with release ID and commit SHA.
- [ ] `health_ready_checks` — `/health` and `/ready` passed after backend deploy.
- [ ] `frontend_deploy` — frontend deployed only after backend health/readiness succeeded.
- [ ] `critical_workflow_smoke_test` — deployed smoke test completed.
- [ ] `release_audit_record` — this record stored with evidence links.

## CI evidence

- `pnpm ci` result:
- `pnpm release:discipline:verify` result:
- Dependency scan result:
- Migration validation result:
- E2E smoke result:

## Migration notes

- Migration set:
- Expand-and-contract used if destructive:
- Forward corrective migration plan:
- Reversible migration tested, if applicable:

## Customer evidence confirmation

- `CUSTOMER_EVIDENCE_ENABLED`:
- `PRODUCTION_GATE_STATUS`:
- Approval reference:

Never set `CUSTOMER_EVIDENCE_ENABLED=true` unless strict production evidence gates are approved.
