# Production Gate — Incident Runbook Minimums

## Gate status

Status: `PENDING_HUMAN_EVIDENCE`

Each runbook must have owner, severity guidance, immediate actions, communications path, evidence preservation steps, and closure criteria.

## Suspected cross-tenant access

Immediate actions: disable affected route/feature, preserve logs, rotate relevant credentials, identify affected tenants, begin response and notification assessment.

## Malware upload

Immediate actions: quarantine object, block download, record security event, investigate related uploads and checksum matches.

## Database outage

Immediate actions: fail closed for mutations, expose service status, restore connectivity or fail over, verify consistency and queued work.

## Object storage outage

Immediate actions: block uploads/downloads gracefully and do not create finalized metadata without recoverable object state.

## AI provider outage

Immediate actions: continue manual workflow, mark AI job retryable, and never block evidence review.

## Worker/Redis outage

Immediate actions: keep synchronous core available, alert, and retry idempotent jobs after recovery.

## Credential leak

Immediate actions: revoke/rotate secret, invalidate sessions if relevant, inspect access logs, and document scope.

## Failed migration

Immediate actions: stop rollout, restore application compatibility, apply tested forward fix or restore from verified backup if necessary.

## Approval

- Incident commander/reviewer:
- Date:
- Decision: `PENDING | APPROVED | REJECTED`
