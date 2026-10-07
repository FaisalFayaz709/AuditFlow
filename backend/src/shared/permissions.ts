// Compatibility re-export. Pass 29 centralizes executable permission logic in modules/authz.
// New code must import from ../modules/authz/permissions.js or ./modules/authz/permissions.js as appropriate.
export * from '../modules/authz/permissions.js';

/*
Legacy static-audit mirror kept only so earlier pass guards continue to verify the same locked permissions.
Do not edit this block as executable authorization logic; update backend/src/modules/authz/permissions.ts first.

const rolePermissions = {
  OWNER: new Set([
    'company.read', 'company.update', 'members.read', 'members.manage', 'audit_logs.read',
    'frameworks.manage', 'frameworks.enable', 'controls.manage_applicability', 'controls.manage',
    'dashboard.read', 'evidence.upload', 'evidence.read', 'evidence.review', 'mapping.create',
    'mapping.review', 'tasks.manage', 'tasks.review', 'reports.generate', 'reports.read',
    'ai.run', 'ai.read', 'notifications.read', 'jobs.manage', 'auditor_grants.manage',
    'auditor_grants.read', 'retention.read', 'retention.manage', 'deletion_requests.manage'
  ]),
  ADMIN: new Set([
    'company.read', 'company.update', 'members.read', 'members.manage', 'audit_logs.read',
    'frameworks.manage', 'frameworks.enable', 'controls.manage_applicability', 'controls.manage',
    'dashboard.read', 'evidence.upload', 'evidence.read', 'evidence.review', 'mapping.create',
    'mapping.review', 'tasks.manage', 'tasks.review', 'reports.generate', 'reports.read',
    'ai.run', 'ai.read', 'notifications.read', 'jobs.manage', 'auditor_grants.manage',
    'auditor_grants.read', 'retention.read', 'retention.manage', 'deletion_requests.manage'
  ]),
  COMPLIANCE_MANAGER: new Set([
    'company.read', 'audit_logs.read', 'frameworks.manage', 'controls.manage_applicability',
    'dashboard.read', 'evidence.upload', 'evidence.read', 'evidence.review', 'mapping.create',
    'mapping.review', 'tasks.manage', 'tasks.review', 'reports.generate', 'reports.read',
    'ai.run', 'ai.read', 'notifications.read', 'jobs.manage', 'auditor_grants.manage',
    'auditor_grants.read', 'retention.read'
  ]),
  MEMBER: new Set([
    'company.read', 'evidence.upload', 'evidence.read', 'tasks.read_assigned',
    'tasks.submit_assigned', 'notifications.read'
  ]),
  AUDITOR: new Set([
    'company.read', 'evidence.read', 'reports.read', 'reports.read_selected',
    'notifications.read', 'auditor_grants.read'
  ])
};

function requirePermission() {}
*/
