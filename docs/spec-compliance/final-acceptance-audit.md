# Final Acceptance Audit

The final acceptance audit verifies that the built product aligns with the locked AuditFlow specification, architecture, stack, security model, readiness model, and production release controls.

## Required proof areas

- Locked stack and modular monolith architecture remain intact.
- Browser auth uses opaque server-side sessions with HttpOnly cookies and CSRF protection.
- Tenant isolation is derived from active company membership.
- RBAC uses centralized permission predicates and resource scope checks.
- Evidence review, mapping review, and task completion remain separate workflows.
- Readiness is calculated only from approved, valid evidence versions and approved mappings.
- AI is optional, advisory, structured, provenance-tracked, and human-in-the-loop.
- Production gate evidence is approved before customer evidence is enabled.
- Release owner approval is recorded before production customer evidence release.

## Required final scenario

The acceptance scenario must prove that every readiness result traces to the framework enrollment, applicable evidence-based controls, requirements, immutable evidence versions, human evidence approvals, human mapping approvals, validity/expiry decisions, and audit events.
