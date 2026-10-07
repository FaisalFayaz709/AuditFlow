export type RequiredFrontendState = 'loading' | 'empty' | 'success' | 'validation' | 'unauthorized' | 'failure';

export type FrontendWorkflowRoute = {
  path: string;
  label: string;
  workflow: string;
  requiredStates: RequiredFrontendState[];
  keyboardPrimaryAction: string;
  nonColorCue: string;
  protectedByBackend: boolean;
};

export const PASS_37_REQUIRED_FRONTEND_STATES: RequiredFrontendState[] = [
  'loading',
  'empty',
  'success',
  'validation',
  'unauthorized',
  'failure',
];

export const PASS_37_FRONTEND_ROUTE_MANIFEST: FrontendWorkflowRoute[] = [
  { path: '/login', label: 'Login / Register', workflow: 'Login/register/session', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Submit auth form', nonColorCue: 'Visible auth state text and request error text', protectedByBackend: false },
  { path: '/members', label: 'Members', workflow: 'Company/member management', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Invite member or change member role', nonColorCue: 'Role and status labels', protectedByBackend: true },
  { path: '/frameworks', label: 'Frameworks', workflow: 'Framework enrollment', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Enable selected published framework version', nonColorCue: 'Version/status labels', protectedByBackend: true },
  { path: '/frameworks/upgrade', label: 'Framework Upgrade', workflow: 'Framework upgrade reconciliation', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Create preview then activate reviewed reconciliation', nonColorCue: 'Matched/added/removed/change-count labels', protectedByBackend: true },
  { path: '/controls', label: 'Controls', workflow: 'Controls and applicability', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Open control detail and manage applicability through backend routes', nonColorCue: 'Applicability/type/risk labels', protectedByBackend: true },
  { path: '/controls/:controlId', label: 'Control Detail', workflow: 'Control detail readiness trace', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Review requirements, tasks, evidence, comments, and readiness trace', nonColorCue: 'Requirement, evidence review, mapping review, and audit labels', protectedByBackend: true },
  { path: '/evidence', label: 'Evidence', workflow: 'Evidence upload and vault', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Upload evidence into staged private flow', nonColorCue: 'Sensitivity, scan, and review labels', protectedByBackend: true },
  { path: '/evidence/:evidenceId', label: 'Evidence Review', workflow: 'Evidence review and mapping review', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Approve/reject evidence and approve/reject mappings separately', nonColorCue: 'Separate evidence review and mapping review badges', protectedByBackend: true },
  { path: '/tasks', label: 'Tasks', workflow: 'Task list and completion semantics', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Open assigned task or submit evidence', nonColorCue: 'Separate task/evidence/mapping labels', protectedByBackend: true },
  { path: '/tasks/:taskId', label: 'Task Detail', workflow: 'Task detail and comments', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Start/submit/complete task according to backend authorization', nonColorCue: 'Task complete versus evidence/mapping review text', protectedByBackend: true },
  { path: '/', label: 'Dashboard', workflow: 'Dashboard/readiness trace', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Open readiness trace', nonColorCue: 'NOT_CALCULABLE text and explanation link', protectedByBackend: true },
  { path: '/reports', label: 'Reports', workflow: 'Report generation and download', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Generate report with selected type/format', nonColorCue: 'Report type/status/schema labels', protectedByBackend: true },
  { path: '/auditor-access', label: 'Auditor Grants', workflow: 'Auditor grant management', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Grant or revoke scoped auditor access', nonColorCue: 'Scope/window/download labels', protectedByBackend: true },
  { path: '/auditor-view', label: 'Auditor View', workflow: 'Auditor read-only selected access', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Open granted control/evidence/report', nonColorCue: 'Scope and expiry labels', protectedByBackend: true },
  { path: '/retention', label: 'Retention', workflow: 'Retention, deletion request, legal hold', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Request deletion or place legal hold', nonColorCue: 'Policy/version/legal-hold labels', protectedByBackend: true },
  { path: '/settings', label: 'Settings', workflow: 'Notification preferences and AI advisory settings', requiredStates: PASS_37_REQUIRED_FRONTEND_STATES, keyboardPrimaryAction: 'Save company/preference settings', nonColorCue: 'Preference/category labels', protectedByBackend: true },
];

export function findRouteManifest(path: string) {
  return PASS_37_FRONTEND_ROUTE_MANIFEST.find((route) => route.path === path);
}
