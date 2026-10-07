import { apiClient } from '../../lib/api-client';
import type { FrameworkSummary } from '../../types/api';

export function listFrameworks() {
  return apiClient.get<{ items: FrameworkSummary[] }>('/api/frameworks');
}

export function enableFramework(companyId: string, csrfToken: string | null, frameworkVersionId: string, targetAuditDate?: string) {
  return apiClient.post<unknown>(
    `/api/companies/${encodeURIComponent(companyId)}/frameworks/${encodeURIComponent(frameworkVersionId)}/enable`,
    { targetAuditDate: targetAuditDate || undefined },
    { companyId, csrfToken },
  );
}


export type FrameworkUpgradePreview = {
  draftEnrollmentId: string;
  oldEnrollmentId: string;
  targetFrameworkVersionId: string;
  matchedControls: number;
  addedControls: number;
  removedControls: number;
  materiallyChangedControls: number;
  mappingCandidatesCopiedAs: 'PENDING_REVIEW';
  requiresAdministratorReview: true;
  activationAllowed: boolean;
};

export type FrameworkUpgradeReconciliation = FrameworkUpgradePreview & {
  controls: Array<{
    oldControlCode?: string | null;
    newControlCode?: string | null;
    matchStatus: 'MATCHED' | 'ADDED' | 'REMOVED' | 'CHANGED' | string;
    proposedOwnerUserId?: string | null;
    proposedApplicability?: string | null;
    requirements?: Array<{ oldRequirementCode?: string | null; newRequirementCode?: string | null; matchStatus: string }>;
  }>;
};

export function createFrameworkUpgradePreview(companyId: string, csrfToken: string | null, enrollmentId: string, targetFrameworkVersionId: string) {
  return apiClient.post<FrameworkUpgradePreview>(
    `/api/frameworks/enrollments/${encodeURIComponent(enrollmentId)}/upgrade-preview`,
    { targetFrameworkVersionId },
    { companyId, csrfToken },
  );
}

export function getFrameworkUpgradeReconciliation(companyId: string, draftEnrollmentId: string) {
  return apiClient.get<FrameworkUpgradeReconciliation>(`/api/frameworks/enrollments/${encodeURIComponent(draftEnrollmentId)}/reconciliation`, { companyId });
}

export function activateFrameworkUpgrade(companyId: string, csrfToken: string | null, draftEnrollmentId: string, body: { reviewed: true; reviewNote?: string }) {
  return apiClient.post<FrameworkUpgradeReconciliation>(
    `/api/frameworks/enrollments/${encodeURIComponent(draftEnrollmentId)}/activate-upgrade`,
    body,
    { companyId, csrfToken },
  );
}
