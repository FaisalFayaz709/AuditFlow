# ADR-003: Browser Authentication Uses Opaque Server-Side Sessions

Status: Accepted

## Context

The v2.1 addendum resolves authentication ambiguity.

## Decision

For Phase 1 browser auth, use a cryptographically random opaque token stored in an HttpOnly cookie.

Cookie:

```txt
auditflow_session=<256-bit random token>
```

Database:

```txt
sessions.token_hash = SHA-256(token + server_pepper)
```

Lookup:

```txt
hash presented cookie
load non-revoked non-expired session
resolve active company memberships
apply permission checks
```

## Required Settings

- HttpOnly: true
- Secure: true in staging/production
- SameSite: Lax by default
- Path: /
- Idle timeout: 12 hours default
- Absolute lifetime: 7 days default
- Password reset revokes active user sessions
- CSRF token is independent and required for state-changing requests

## Rejected Alternatives

- Browser JWT access tokens for MVP.
- Trusting company scope from cookie claims.
- Long-lived unrevocable tokens.
