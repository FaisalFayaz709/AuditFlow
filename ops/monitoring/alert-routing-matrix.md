# Alert Routing Matrix

Status: `SOURCE_OPERATIONS_RECOVERY_RUNTIME_GATE_PREPARED_PNPM_RUNTIME_PENDING`

This matrix turns the v2.1 operations baseline into explicit alert ownership without introducing Kubernetes, microservices, event streaming, or another database.

| Alert ID | Trigger | Primary owner | Immediate response | Sensitive-data rule |
|---|---|---|---|---|
| repeated_5xx | repeated backend 5xx responses over a short window | Deployment/release owner | preserve request IDs, check release, rollback or forward-fix | no passwords, tokens, storage keys, full evidence text, signed URLs, or AI payloads |
| readiness_not_ready | `/ready` non-200 or dependency status failed | Database/recovery owner | fail closed for mutations where needed, restore dependency | log request IDs and dependency class only |
| login_abuse | repeated failed login/reset attempts | Security incident owner | rate-limit, block source where appropriate, preserve auth audit events | never log submitted passwords or reset tokens |
| worker_failure | worker failure or dead-letter growth | Deployment/release owner | alert, pause risky retries, resume idempotent jobs after recovery | no payload dumps with evidence text |
| storage_failure | object upload/download failures | Object storage owner | block unsafe finalization/download, run reconciliation | never expose object keys or signed URLs |
| database_connectivity | PostgreSQL unavailable or pool exhausted | Database/recovery owner | expose service status, fail closed for mutations, restore/fail over | no credentials in logs |
| backup_failure | missed backup/PITR or backup job failure | Database/recovery owner | stop production evidence approval if backup is untrusted | record evidence location, not secrets |
| restore_test_due | restore test missing or stale before release/customer evidence | Database/recovery owner | run production-equivalent restore test and record result | use approved data-handling procedure |
| storage_database_reconciliation_failure | evidence metadata/object mismatch | Object storage owner | mark affected evidence unavailable, retry reconciliation, audit repair | no object secret paths in alerts |

Customer-evidence release remains blocked until strict production gates pass with real evidence.
