# AuditFlow UI/UX System

AuditFlow uses a professional enterprise SaaS interface built around three principles:

1. **Trust first** — compliance users must immediately see workspace, role, authorization, and review state.
2. **Workflow clarity** — evidence review, mapping review, and task completion are intentionally separate.
3. **Low-friction execution** — common actions such as uploading evidence, creating tasks, and generating reports are visible from the relevant screen header.

## Layout

The application shell uses a persistent left navigation, a sticky session/workspace top bar, and an optional right insight rail. The navigation is grouped by workflow:

- Overview
- Compliance work
- Governance

The top bar always shows active workspace, user/session state, and role. This supports tenant awareness and reduces cross-company mistakes.

## Visual design

The interface uses a calm enterprise palette with high contrast, large cards, rounded corners, clear hierarchy, and readable form controls. Status badges use text labels as well as color so the UI is usable without relying on color alone.

## Key user experience decisions

- Dashboard actions guide users to evidence upload and report generation.
- Evidence upload is anchored from the Evidence Vault header.
- Task creation is anchored from the Tasks header.
- Auditor, retention, notification, and workspace areas live under Governance.
- Empty, loading, warning, success, and error states are treated as first-class UI components.

## Accessibility

The UI keeps the existing skip link, visible focus rings, semantic headings, role-aware navigation labels, and non-color status cues.

## Implementation files

- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/styles.css`
- Major workflow pages under `frontend/src/pages/`
