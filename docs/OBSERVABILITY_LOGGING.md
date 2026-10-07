# Observability and Logging Policy

## Required telemetry

- Request ID for every HTTP request.
- Structured JSON logs.
- Route, status code, latency, and safe user/company identifiers when useful.
- Error tracking for unexpected failures.
- Uptime checks for `/health` and `/ready`.
- Alerts for 5xx, login abuse, worker failures, storage failures, and database connectivity.

## Redaction requirements

Never log:

- passwords
- session tokens
- CSRF tokens
- signed file URLs
- storage keys
- full evidence text
- sensitive AI prompts or payloads
- provider secrets

## Readiness semantics

- `/health` means the process is alive.
- `/ready` means required dependencies are ready for traffic.
- `/ready` may return 503 if PostgreSQL or another required dependency is unavailable.
