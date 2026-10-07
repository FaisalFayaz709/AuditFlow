import type { MembershipRole } from '../types/api';

export type FrontendNavItem = {
  to: string;
  label: string;
  workflow: string;
  visibleTo?: MembershipRole[];
  readOnlyForAuditor?: boolean;
  requiresBackendAuthorization: true;
};

export const PASS_51_FRONTEND_NAV_ITEMS: FrontendNavItem[] = [
  { to: '/', label: 'Dashboard', workflow: 'Dashboard/readiness trace', visibleTo: ['OWNER', 'ADMIN', 'COMPLIANCE_MANAGER', 'MEMBER', 'AUDITOR'], readOnlyForAuditor: true, requiresBackendAuthorization: true },
  { to: '/members', label: 'Members', workflow: 'Company/member management', visibleTo: ['OWNER', 'ADMIN'], requiresBackendAuthorization: true },
  { to: '/frameworks', label: 'Frameworks', workflow: 'Framework enrollment', visibleTo: ['OWNER', 'ADMIN', 'COMPLIANCE_MANAGER'], requiresBackendAuthorization: true },
  { to: '/frameworks/upgrade', label: 'Framework Upgrade', workflow: 'Framework upgrade reconciliation', visibleTo: ['OWNER', 'ADMIN', 'COMPLIANCE_MANAGER'], requiresBackendAuthorization: true },
  { to: '/controls', label: 'Controls', workflow: 'Controls and applicability', visibleTo: ['OWNER', 'ADMIN', 'COMPLIANCE_MANAGER', 'AUDITOR'], readOnlyForAuditor: true, requiresBackendAuthorization: true },
  { to: '/evidence', label: 'Evidence', workflow: 'Evidence upload and vault', visibleTo: ['OWNER', 'ADMIN', 'COMPLIANCE_MANAGER', 'MEMBER'], requiresBackendAuthorization: true },
  { to: '/tasks', label: 'Tasks', workflow: 'Task list and completion semantics', visibleTo: ['OWNER', 'ADMIN', 'COMPLIANCE_MANAGER', 'MEMBER'], requiresBackendAuthorization: true },
  { to: '/reports', label: 'Reports', workflow: 'Report generation and download', visibleTo: ['OWNER', 'ADMIN', 'COMPLIANCE_MANAGER', 'AUDITOR'], readOnlyForAuditor: true, requiresBackendAuthorization: true },
  { to: '/auditor-access', label: 'Auditor Access', workflow: 'Auditor grant management', visibleTo: ['OWNER', 'ADMIN', 'COMPLIANCE_MANAGER'], requiresBackendAuthorization: true },
  { to: '/auditor-view', label: 'Auditor View', workflow: 'Auditor read-only selected access', visibleTo: ['AUDITOR', 'OWNER', 'ADMIN', 'COMPLIANCE_MANAGER'], readOnlyForAuditor: true, requiresBackendAuthorization: true },
  { to: '/retention', label: 'Retention', workflow: 'Retention, deletion request, legal hold', visibleTo: ['OWNER', 'ADMIN'], requiresBackendAuthorization: true },
  { to: '/settings', label: 'Settings', workflow: 'Notification preferences and AI advisory settings', visibleTo: ['OWNER', 'ADMIN', 'COMPLIANCE_MANAGER'], requiresBackendAuthorization: true },
];

export function navVisibleForRole(item: FrontendNavItem, role: MembershipRole | null | undefined): boolean {
  if (!item.visibleTo || item.visibleTo.length === 0) return true;
  if (!role) return false;
  return item.visibleTo.includes(role);
}

export function getVisibleNavItemsForRole(role: MembershipRole | null | undefined): FrontendNavItem[] {
  return PASS_51_FRONTEND_NAV_ITEMS.filter((item) => navVisibleForRole(item, role));
}
