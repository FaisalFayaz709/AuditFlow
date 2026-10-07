import type { PermissionAction } from './permissions.js';
import type { AuthorizationPredicateId } from './predicates.js';

export const SECURITY_ACCEPTANCE_PASS = 'Pass 52' as const;

export type SecurityAcceptanceControl = {
  id: string;
  lockedSpecRule: string;
  enforcement: string;
  runtimeEvidence: string[];
  customerEvidenceRelease: 'blockedUntilProductionGatePasses';
};

export const SECURITY_ACCEPTANCE_CONTROLS: readonly SecurityAcceptanceControl[] = [
  {
    id: 'cross_tenant_reads_fail_closed',
    lockedSpecRule: 'Every read of tenant-owned business data is loaded inside active CompanyMember scope.',
    enforcement: 'tenant.scoped_entity_lookup plus route permission predicate and tenant-safe not-found response.',
    runtimeEvidence: ['tenant-boundary.test.ts', 'authz-cross-tenant-policy.test.ts', 'security-acceptance-runtime-pass52.test.ts'],
    customerEvidenceRelease: 'blockedUntilProductionGatePasses',
  },
  {
    id: 'cross_tenant_writes_fail_closed',
    lockedSpecRule: 'Every mutation requires active membership, exact permission, resource ownership predicate, and CSRF where authenticated.',
    enforcement: 'centralized authorization predicates plus contract-completion CSRF metadata for authenticated state-changing routes.',
    runtimeEvidence: ['security-route-contracts.test.ts', 'auth-session-csrf-rbac-runtime.test.ts', 'security-acceptance-runtime-pass52.test.ts'],
    customerEvidenceRelease: 'blockedUntilProductionGatePasses',
  },
  {
    id: 'cross_tenant_downloads_fail_closed',
    lockedSpecRule: 'Evidence downloads require tenant authorization and auditors require active scoped grants.',
    enforcement: 'evidence.read permission, auditor.active_scope_grant predicate, and download blocking for unsafe evidence lifecycle states.',
    runtimeEvidence: ['evidence-upload-security-runtime.test.ts', 'authz-cross-tenant-policy.test.ts', 'security-acceptance-runtime-pass52.test.ts'],
    customerEvidenceRelease: 'blockedUntilProductionGatePasses',
  },
  {
    id: 'member_cannot_review_evidence_or_mappings',
    lockedSpecRule: 'Only OWNER, ADMIN, or COMPLIANCE_MANAGER may approve/reject evidence and mappings.',
    enforcement: 'evidence.review and mapping.review are absent from MEMBER permissions and guarded by exact predicates.',
    runtimeEvidence: ['permissions.test.ts', 'evidence-review-mapping-readiness-runtime.test.ts', 'security-acceptance-runtime-pass52.test.ts'],
    customerEvidenceRelease: 'blockedUntilProductionGatePasses',
  },
  {
    id: 'auditor_is_read_only_and_grant_scoped',
    lockedSpecRule: 'AUDITOR has read-only selected access and may not mutate tenant business state.',
    enforcement: 'AUDITOR lacks mutation permissions; auditor grants are explicit, bounded, and checked independently for evidence/report access.',
    runtimeEvidence: ['permissions.test.ts', 'security-acceptance-runtime-pass52.test.ts'],
    customerEvidenceRelease: 'blockedUntilProductionGatePasses',
  },
  {
    id: 'csrf_blocks_authenticated_mutations_without_token',
    lockedSpecRule: 'State-changing requests use an independent CSRF token validated separately from the session cookie.',
    enforcement: 'authenticated POST/PATCH/DELETE/PUT route contracts require csrfRequiredForStateChange=true and csrf plugin validates headers.',
    runtimeEvidence: ['security-route-contracts.test.ts', 'auth-session-csrf-rbac-runtime.test.ts', 'security-acceptance-runtime-pass52.test.ts'],
    customerEvidenceRelease: 'blockedUntilProductionGatePasses',
  },
  {
    id: 'sensitive_fields_redacted',
    lockedSpecRule: 'Sensitive tokens, signed URLs, storage keys, full evidence text, and AI prompts are excluded from logs and unintended responses.',
    enforcement: 'Fastify logger redact list plus source-level response-contract checks.',
    runtimeEvidence: ['sensitive-data-exposure.test.ts', 'security-acceptance-runtime-pass52.test.ts'],
    customerEvidenceRelease: 'blockedUntilProductionGatePasses',
  },
] as const;

export const SECURITY_ACCEPTANCE_REQUIRED_REDACTIONS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers.x-csrf-token',
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'storage_key',
  'temporary_storage_key',
  'final_storage_key',
  'signedUrl',
  'extracted_text',
  'structured_result_json',
  'untrustedDocumentText',
  'prompt',
  'aiPrompt',
  'providerMessageId',
  'notification.body',
  'delivery.last_error',
] as const;

export const SECURITY_ACCEPTANCE_AUTHENTICATED_MUTATION_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'] as const;

export const SECURITY_ACCEPTANCE_PUBLIC_MUTATION_ROUTES = new Set([
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password',
  'POST /api/auth/verify-email',
]);

export const SECURITY_ACCEPTANCE_FORBIDDEN_AUDITOR_PERMISSIONS: readonly PermissionAction[] = [
  'company.update',
  'company.profile.update',
  'members.manage',
  'members.role.change',
  'members.remove',
  'frameworks.manage',
  'frameworks.enable',
  'controls.manage',
  'controls.manage_applicability',
  'evidence.upload',
  'evidence.review',
  'evidence.manage',
  'mapping.create',
  'mapping.review',
  'tasks.create',
  'tasks.manage',
  'tasks.review',
  'reports.generate',
  'ai.run',
  'jobs.manage',
  'auditor_grants.manage',
  'deletion_requests.manage',
  'retention.manage',
];

export const SECURITY_ACCEPTANCE_REQUIRED_PREDICATES: readonly AuthorizationPredicateId[] = [
  'tenant.active_membership',
  'tenant.scoped_entity_lookup',
  'evidence.read',
  'evidence.review',
  'mapping.review',
  'tasks.read_assigned',
  'tasks.submit_assigned',
  'auditor.active_scope_grant',
  'audit_logs.read',
];

export function listSecurityAcceptanceControlIds(): string[] {
  return SECURITY_ACCEPTANCE_CONTROLS.map((control) => control.id);
}

export function findMissingSecurityRedactions(configuredRedactions: readonly string[]): string[] {
  return SECURITY_ACCEPTANCE_REQUIRED_REDACTIONS.filter((redaction) => !configuredRedactions.includes(redaction));
}

export function assertTenantSafeErrorDetails(details: readonly unknown[] | undefined): boolean {
  return Array.isArray(details) && details.length === 0;
}
