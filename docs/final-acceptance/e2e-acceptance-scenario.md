# End-to-End Acceptance Scenario

This scenario proves that the core AuditFlow workflow can be completed without violating tenant isolation, RBAC, evidence-review boundaries, mapping-review boundaries, or readiness semantics.

## Scenario

1. Create or select a company workspace.
2. Register/login with an authorized user.
3. Invite a member and assign the correct role.
4. Enable a framework for the company.
5. Review controls and required evidence requirements.
6. Create an evidence task with owner and due date.
7. Upload evidence through the staged private-upload workflow.
8. Confirm validation, storage finalization, and audit events.
9. Approve evidence as an authorized reviewer.
10. Create and approve a mapping to the required evidence requirement.
11. Verify that readiness changes only after the approved evidence and approved mapping exist.
12. Generate a report using readiness/evidence language only.
13. Create a time-bounded auditor grant and verify read-only access.
14. Confirm cross-tenant access attempts fail without leaking existence.
15. Confirm audit logs trace every important mutation.

## Acceptance rule

The scenario passes only when readiness trace explains the percentage and no step relies on certification, automatic compliance, browser JWT auth, public object URLs, or AI auto-approval.
