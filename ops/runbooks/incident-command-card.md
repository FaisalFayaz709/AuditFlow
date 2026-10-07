# Incident Command Card

This command card summarizes the minimum runbooks required before customer evidence release.

## suspected_cross_tenant_access
Disable affected route or feature, preserve request IDs and audit logs, rotate relevant credentials, identify affected tenants, assess notification obligations.

## malware_upload
Quarantine object, block download, record security event, investigate checksum matches and related uploads.

## database_outage
Fail closed for mutations, expose service status, restore connectivity or fail over, verify consistency and queued work.

## object_storage_outage
Block uploads/downloads gracefully and do not create finalized metadata without recoverable object state.

## ai_provider_outage
Continue manual evidence workflow, mark AI job retryable, never block evidence review.

## worker_redis_outage
Keep synchronous core available, alert, pause unsafe retries, retry idempotent jobs after recovery.

## credential_leak
Revoke/rotate secret, invalidate sessions if relevant, inspect access logs, document scope and affected tenants.

## failed_migration
Stop rollout, restore application compatibility, apply tested forward fix, or restore from verified backup if necessary.

All incident records must avoid passwords, session tokens, CSRF tokens, signed URLs, storage keys, full evidence text, and sensitive AI payloads.
