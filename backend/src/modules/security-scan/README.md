# Pass 26 Security Scan Adapter

AuditFlow v2.1 requires malware/security validation before evidence approval in production. This module keeps scanning inside the modular monolith through a provider interface; it does not introduce a scanner microservice owned by the application.

## Providers

- `fake`: local/test-only provider. It detects the EICAR marker so tests can exercise the `SECURITY_REJECTED` branch.
- `clamav`: production-capable ClamAV/clamd INSTREAM provider.

## Locked rules

- Staging and production must use `SECURITY_SCAN_MODE=required`.
- Staging and production must use a real provider such as `clamav`; `fake` is rejected at environment validation/provider creation.
- `disabled_non_production` is allowed only outside staging/production and is explicit provenance for a development/test bypass.
- Evidence approval requires `security_scan_status=CLEAN`, except explicit non-production bypass with `NOT_REQUIRED`.
- `QUARANTINED` and `SECURITY_REJECTED` evidence versions are blocked by normal download routes.
