# Independent Threat Review Template

Status: BLOCKED until completed.

## Scope

Review the modular monolith backend, React frontend, PostgreSQL schema, object storage, session/CSRF model, tenant isolation, evidence upload/download, AI analysis, jobs/notifications, auditor grants, retention/deletion, and deployment pipeline.

## Required threat areas

- cross-tenant data access / IDOR
- session theft and revocation behavior
- CSRF on state-changing routes
- role/permission bypass
- evidence upload validation and malware handling
- unauthorized evidence/report download
- prompt injection through evidence text
- sensitive logging exposure
- object storage/database inconsistency
- deletion/legal hold bypass
- auditor grant overexposure
- backup/restore and secret exposure

## Findings

| ID | Severity | Area | Finding | Required fix or accepted risk | Owner | Status |
|---|---|---|---|---|---|---|
| TR-001 | | | | | | OPEN |

## Approval

- Reviewer:
- Date:
- Open critical/high findings: yes/no
- Approved for customer evidence: yes/no
- Approver:
