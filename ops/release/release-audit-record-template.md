# Release Audit Record Template

## Release identity

- Environment:
- Release ID:
- Commit SHA:
- Operator:
- Approval reference:
- Started at:
- Completed at:

## Mandatory production release sequence

- [ ] Approved change recorded.
- [ ] Backup verification completed before migration.
- [ ] Controlled migration reviewed and applied.
- [ ] Backend deploy completed.
- [ ] `/health` check passed.
- [ ] `/ready` check passed.
- [ ] Frontend deploy completed.
- [ ] Critical workflow smoke test passed.
- [ ] Release audit record stored.

## Migration notes

- Migration set:
- Expand-and-contract or forward corrective migration used if destructive:
- Rollback or forward-fix plan:

## Smoke result

- Overall result: PASS / FAIL
- Failed checks:
- Follow-up action:

## Evidence handling confirmation

- Private object storage configured:
- Malware scanner configured:
- Customer evidence gate status:
- Last restore test status:
