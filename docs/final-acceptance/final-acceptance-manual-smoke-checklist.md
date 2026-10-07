# Final Acceptance Manual Smoke Checklist

Run this checklist after automated CI and controlled-release checks are complete.

| Check | Evidence link | Result |
|---|---|---|
| `/health` includes service identity, release ID, and commit SHA |  |  |
| `/ready` confirms database and enabled dependencies |  |  |
| Register/login works with opaque session cookie |  |  |
| CSRF protects state-changing authenticated requests |  |  |
| Framework enablement works |  |  |
| Evidence upload finalizes private storage safely |  |  |
| Evidence approval requires authorized human review |  |  |
| Mapping approval requires authorized human review |  |  |
| Readiness trace explains every percentage |  |  |
| Report generation avoids certification/legal-compliance claims |  |  |
| Auditor grant is time-bounded and read-only |  |  |
| Cross-tenant access attempt fails safely |  |  |
| Audit logs exist for important mutations |  |  |

Customer evidence remains disabled until the production gate and release-owner approval are complete.
