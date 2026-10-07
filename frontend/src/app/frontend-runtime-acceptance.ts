import { PASS_37_FRONTEND_ROUTE_MANIFEST, PASS_37_REQUIRED_FRONTEND_STATES } from './frontend-route-manifest';
import { PASS_51_FRONTEND_NAV_ITEMS } from './frontend-navigation-policy';

export type Pass51RuntimeRoute = {
  path: string;
  concreteSmokePath: string;
  page: string;
  workflow: string;
  requiredAssertions: string[];
};

export const PASS_51_FRONTEND_RUNTIME_ROUTES: Pass51RuntimeRoute[] = [
  { path: '/', concreteSmokePath: '/', page: 'DashboardPage', workflow: 'Dashboard/readiness trace', requiredAssertions: ['main-content visible', 'readiness not certification', 'NOT_CALCULABLE visible when returned'] },
  { path: '/login', concreteSmokePath: '/login', page: 'LoginRegisterPage', workflow: 'Login/register/session', requiredAssertions: ['semantic form labels', 'validation summary', 'CSRF-aware auth client'] },
  { path: '/members', concreteSmokePath: '/members', page: 'MembersPage', workflow: 'Company/member management', requiredAssertions: ['role labels', 'backend authorization authoritative', 'validation state'] },
  { path: '/frameworks', concreteSmokePath: '/frameworks', page: 'FrameworksPage', workflow: 'Framework enrollment', requiredAssertions: ['published version labels', 'enable framework action', 'empty state'] },
  { path: '/frameworks/upgrade', concreteSmokePath: '/frameworks/upgrade', page: 'FrameworkUpgradePage', workflow: 'Framework upgrade reconciliation', requiredAssertions: ['DRAFT_RECONCILIATION preview', 'PENDING_REVIEW mappings', 'no auto approval'] },
  { path: '/controls', concreteSmokePath: '/controls', page: 'ControlsPage', workflow: 'Controls and applicability', requiredAssertions: ['control type labels', 'applicability labels', 'risk labels'] },
  { path: '/controls/:controlId', concreteSmokePath: '/controls/demo-control', page: 'ControlDetailPage', workflow: 'Control detail readiness trace', requiredAssertions: ['requirements visible', 'approved/pending evidence labels', 'comments/history states'] },
  { path: '/evidence', concreteSmokePath: '/evidence', page: 'EvidenceVaultPage', workflow: 'Evidence upload and vault', requiredAssertions: ['private evidence notice', 'sensitivity labels', 'scan/review labels'] },
  { path: '/evidence/:evidenceId', concreteSmokePath: '/evidence/demo-evidence', page: 'EvidenceDetailPage', workflow: 'Evidence review and mapping review', requiredAssertions: ['evidence badge separate from mapping badge', 'no storage_key exposure', 'download uses API authorization'] },
  { path: '/tasks', concreteSmokePath: '/tasks', page: 'TasksPage', workflow: 'Task list and completion semantics', requiredAssertions: ['Task COMPLETED wording', 'derived overdue label', 'separate evidence/mapping status'] },
  { path: '/tasks/:taskId', concreteSmokePath: '/tasks/demo-task', page: 'TaskDetailPage', workflow: 'Task detail and comments', requiredAssertions: ['task completion separate', 'comment authorization', 'submission workflow labels'] },
  { path: '/reports', concreteSmokePath: '/reports', page: 'ReportsPage', workflow: 'Report generation and download', requiredAssertions: ['schemaVersion visible', 'readiness/evidence coverage language', 'no certification wording'] },
  { path: '/settings', concreteSmokePath: '/settings', page: 'SettingsPage', workflow: 'Notification preferences and AI advisory settings', requiredAssertions: ['AI optionality', 'preference categories', 'manual workflow remains'] },
  { path: '/auditor-access', concreteSmokePath: '/auditor-access', page: 'AuditorAccessPage', workflow: 'Auditor grant management', requiredAssertions: ['bounded access window', 'scope labels', 'download toggle'] },
  { path: '/auditor-view', concreteSmokePath: '/auditor-view', page: 'AuditorViewPage', workflow: 'Auditor read-only selected access', requiredAssertions: ['read-only access', 'scope and expiry labels', 'no mutation controls'] },
  { path: '/retention', concreteSmokePath: '/retention', page: 'RetentionPage', workflow: 'Retention, deletion request, legal hold', requiredAssertions: ['archive first', 'legal hold', 'background purge warning'] },
];

export const PASS_51_FRONTEND_RUNTIME_ACCEPTANCE = {
  pass: 'Pass 51 Frontend Runtime and Accessibility',
  lockedStack: ['React', 'TypeScript', 'Vite', 'React Router', 'Playwright', 'Vitest'],
  forbiddenStackDrift: ['Next.js', 'Angular', 'Vue', 'Redux requirement', 'client-only authorization'],
  requiredUiStates: PASS_37_REQUIRED_FRONTEND_STATES,
  routes: PASS_51_FRONTEND_RUNTIME_ROUTES,
  navItems: PASS_51_FRONTEND_NAV_ITEMS,
  runtimeCommands: [
    'pnpm --filter @auditflow/frontend typecheck',
    'pnpm --filter @auditflow/frontend build',
    'pnpm test:frontend-runtime',
    'pnpm test:e2e',
  ],
  customerEvidenceRelease: 'blockedUntilProductionGatePasses',
} as const;

export function validatePass51FrontendRuntimeAcceptance(): string[] {
  const failures: string[] = [];
  const manifestPaths = new Set(PASS_37_FRONTEND_ROUTE_MANIFEST.map((route) => route.path));
  for (const route of PASS_51_FRONTEND_RUNTIME_ROUTES) {
    if (!manifestPaths.has(route.path)) failures.push(`${route.path} is missing from the frontend workflow manifest.`);
    if (route.requiredAssertions.length < 3) failures.push(`${route.path} must declare concrete smoke/accessibility assertions.`);
  }
  for (const manifestRoute of PASS_37_FRONTEND_ROUTE_MANIFEST) {
    if (!PASS_51_FRONTEND_RUNTIME_ROUTES.some((route) => route.path === manifestRoute.path)) {
      failures.push(`${manifestRoute.path} is missing from Pass 51 runtime smoke coverage.`);
    }
  }
  if (!PASS_51_FRONTEND_NAV_ITEMS.every((item) => item.requiresBackendAuthorization)) {
    failures.push('Every navigation item must state that backend authorization remains authoritative.');
  }
  return failures;
}
