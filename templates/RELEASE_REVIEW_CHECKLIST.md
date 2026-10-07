# Release Review Checklist

Use this checklist before merging each product change or release-preparation change.

## General

- [ ] The change stays within the approved product scope.
- [ ] No locked architecture or stack decision is changed.
- [ ] No microservices or Kubernetes dependency was introduced.
- [ ] No browser JWT auth was introduced.
- [ ] No AI state-changing behavior was introduced.

## Code quality

- [ ] Format check passes.
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Build passes.

## Security

- [ ] No secrets committed.
- [ ] No sensitive values logged.
- [ ] No wildcard credentialed CORS.
- [ ] Error responses use standardized envelope.

## Documentation

- [ ] README or relevant docs updated.
- [ ] Known limitations documented.
- [ ] Release/operations evidence updated where applicable.
