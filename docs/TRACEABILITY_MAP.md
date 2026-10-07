# Specification Traceability Map

This file maps locked implementation decisions to their source section in the specification.

| Decision | Source Area |
|---|---|
| v2.1 overrides conflicting v2.0 | v2.1 Document Control |
| Modular monolith | v2.0 High-Level System Architecture; v2.1 Document Control |
| Stack lock | v2.0 Recommended Technology Stack |
| Opaque browser sessions | v2.1 Canonical Authentication and Session Architecture |
| Tenant isolation | v2.0 Multi-Tenancy Rule; v2.1 Exact Permission Predicates |
| RBAC roles and protected operations | v2.0 RBAC Matrix; v2.1 Exact Permission Predicates |
| Evidence requirements as first-class objects | v2.0 Evidence Requirements |
| Evidence lifecycle with quarantine/security rejection | v2.1 Revised Evidence Version Lifecycle |
| Evidence version immutability | v2.0 Evidence Lifecycle; v2.1 Revised Evidence Version Lifecycle |
| Separate evidence approval and mapping approval | v2.0 Evidence Review Rules; v2.0 Mapping Lifecycle |
| Readiness formula | v2.0 Canonical Readiness Score Formula; v2.1 Control Types and Readiness Semantics |
| Informational controls excluded from readiness | v2.1 Control Types and Readiness Semantics |
| Framework upgrade reconciliation | v2.1 Framework Enrollment and Upgrade Reconciliation |
| Task `COMPLETED` instead of `APPROVED` | v2.1 Task Lifecycle Clarification |
| Staged upload and reconciliation | v2.1 Atomic File Upload and Reconciliation |
| Auditor access grants | v2.1 Auditor Access Grant Model |
| Retention/deletion workflow | v2.1 Retention, Deletion, and Legal Hold Baseline |
| AI human-in-the-loop | v2.0 AI Responsibilities/Prohibited Actions; v2.1 AI Principle |
| Production gates | v2.1 Production Non-Functional Gates |
| Expanded definition of done | v2.1 Expanded Definition of Done |

## Rule

If implementation and this traceability map conflict, stop and resolve the inconsistency against the original specification before coding.
