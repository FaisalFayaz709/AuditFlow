# Secret Rotation Procedure

Status: BLOCKED until tested.

## Secrets in scope

- `SESSION_PEPPER`
- database credentials
- object storage credentials
- Redis credentials
- email provider credentials
- AI provider credentials if external AI is enabled
- error tracking DSN or tokens
- deployment platform tokens

## Procedure

1. Identify exposed or scheduled-rotation secret.
2. Create replacement in the platform secret manager.
3. Deploy application configuration using the new secret.
4. Revoke old credential at the provider.
5. Invalidate sessions if session material or authentication credentials were exposed.
6. Verify `/ready`, login, evidence upload/download, jobs, and reports.
7. Record rotation event and owner.

## Test record

- Secret category tested:
- Test date:
- Systems verified:
- Rollback procedure verified: yes/no
- Owner:
