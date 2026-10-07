# auth module

Pass 03 owns canonical browser authentication for AuditFlow.

Implemented boundaries:

- Opaque server-side session token in `auditflow_session` HttpOnly cookie.
- Raw session token is never persisted; PostgreSQL stores only `SHA-256(token + server_pepper)`.
- Session lookup checks `revoked_at`, idle expiry, and absolute expiry on every request.
- CSRF token is server-issued and validated independently from the auth cookie for authenticated state-changing requests.
- Password reset revokes existing sessions.
- Register creates the initial company and OWNER membership in one transaction where possible.

Still out of scope for this pass:

- Company member administration and invitations; Pass 04 owns those.
- SSO/OIDC/SAML/SCIM.
- JWT browser authentication.
- Advanced risk engine or external email provider delivery.
