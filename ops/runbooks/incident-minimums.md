# Incident Runbook Minimums

## Suspected cross-tenant access
Disable the affected route or feature, preserve logs, rotate relevant credentials, identify affected tenants, and begin incident response plus notification assessment.

## Malware upload
Quarantine the object, block download, record a security event, and investigate matching checksums or related uploads.

## Database outage
Fail closed for mutations, expose service status, restore connectivity or fail over, and verify consistency plus queued work after recovery.

## Object storage outage
Block uploads/downloads gracefully and do not create finalized metadata without recoverable object state.

## AI provider outage
Continue manual workflow, mark AI job retryable, and never block evidence review.

## Worker/Redis outage
Keep synchronous core available, alert, and retry idempotent jobs after recovery.

## Credential leak
Revoke/rotate the secret, invalidate sessions if relevant, inspect access logs, and document scope.

## Failed migration
Stop rollout, restore application compatibility, apply tested forward fix, or restore from a verified backup if necessary.
