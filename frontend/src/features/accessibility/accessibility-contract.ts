import { PASS_37_FRONTEND_ROUTE_MANIFEST, PASS_37_REQUIRED_FRONTEND_STATES } from '../../app/frontend-route-manifest';

export const PASS_37_ACCESSIBILITY_CONTRACT = {
  semanticRegions: ['header', 'nav', 'main', 'section', 'form', 'table'],
  requiredStates: PASS_37_REQUIRED_FRONTEND_STATES,
  keyboardWorkflows: PASS_37_FRONTEND_ROUTE_MANIFEST.map((route) => ({
    path: route.path,
    workflow: route.workflow,
    keyboardPrimaryAction: route.keyboardPrimaryAction,
  })),
  statusCuePolicy: {
    nonColorRequired: true,
    requiredCueExamples: ['visible text labels', 'aria-label values', 'table headings', 'badge prefixes'],
    forbiddenPattern: 'color-only status meaning',
  },
  sensitiveUiPolicy: {
    noPermanentEvidenceUrls: true,
    noSecretStorageKeys: true,
    noRawSessionTokens: true,
    backendAuthorizationIsAuthoritative: true,
  },
} as const;

export function validatePass37FrontendManifest() {
  const failures: string[] = [];
  const requiredWorkflows = [
    'Login/register/session',
    'Company/member management',
    'Framework enrollment',
    'Framework upgrade reconciliation',
    'Controls and applicability',
    'Evidence upload and vault',
    'Evidence review and mapping review',
    'Task list and completion semantics',
    'Dashboard/readiness trace',
    'Report generation and download',
    'Auditor grant management',
    'Auditor read-only selected access',
    'Retention, deletion request, legal hold',
  ];

  for (const workflow of requiredWorkflows) {
    if (!PASS_37_FRONTEND_ROUTE_MANIFEST.some((route) => route.workflow === workflow)) {
      failures.push(`Missing workflow route: ${workflow}`);
    }
  }

  for (const route of PASS_37_FRONTEND_ROUTE_MANIFEST) {
    for (const state of PASS_37_REQUIRED_FRONTEND_STATES) {
      if (!route.requiredStates.includes(state)) failures.push(`${route.path} missing ${state} state`);
    }
    if (!route.nonColorCue) failures.push(`${route.path} missing non-color cue`);
  }

  return failures;
}
