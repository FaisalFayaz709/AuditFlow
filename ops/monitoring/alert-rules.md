# Minimum Alert Rules

Required before real customer evidence:

1. Repeated backend 5xx responses over a short window.
2. `/ready` returning non-200.
3. PostgreSQL unavailable or storage capacity high.
4. Object storage upload/download failures.
5. Worker failures or dead-letter accumulation.
6. Authentication abuse / repeated failed login attempts.
7. Evidence upload security failures or malware detections.
8. Backup job failure or missed restore-test schedule.
9. Storage/database reconciliation failures.
10. Error tracking spike for state-changing routes.

Alerts must avoid passwords, tokens, signed URLs, storage keys, full evidence text, and sensitive AI payloads.
