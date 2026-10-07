# ADR-001: Use Modular Monolith for Phase 1

Status: Accepted

## Context

AuditFlow must be buildable as an MVP while preserving clear internal boundaries, tenant isolation, evidence lifecycle correctness, and readiness traceability.

## Decision

Use one deployable Fastify backend application with internal modules.

Allowed internal modules include:

- auth
- companies
- invitations
- frameworks
- controls
- evidence
- mappings
- tasks
- comments
- dashboard
- reports
- audit-logs
- ai
- notifications
- jobs

Modules communicate through service interfaces rather than importing each other's persistence details.

## Consequences

Positive:

- Simpler deployment.
- Fewer distributed failure modes.
- Easier transactional correctness.
- Easier learning and portfolio delivery.
- Stronger control over tenant-scoped queries.

Negative:

- Internal discipline is required to prevent module coupling.
- Scaling is application-level before service-level.

## Prohibited

- Microservices in Phase 1.
- Kubernetes requirement in Phase 1.
- Distributed transactions.
- Multiple databases per module.
