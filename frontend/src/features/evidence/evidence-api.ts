import { apiClient } from '../../lib/api-client';
import type { EvidenceItem } from '../../types/api';

export function listEvidence(companyId: string) {
  return apiClient.get<{ items: EvidenceItem[] }>('/api/evidence', { companyId });
}

export function getEvidence(companyId: string, evidenceId: string) {
  return apiClient.get<EvidenceItem>(`/api/evidence/${encodeURIComponent(evidenceId)}`, { companyId });
}

export function uploadEvidence(companyId: string, csrfToken: string | null, formData: FormData) {
  return apiClient.upload<EvidenceItem>('/api/evidence/upload', formData, { companyId, csrfToken });
}

export function approveEvidenceVersion(
  companyId: string,
  csrfToken: string | null,
  versionId: string,
  body: { reviewNote?: string; effectiveFrom?: string; effectiveUntil?: string; expiryDate?: string },
) {
  return apiClient.post<EvidenceItem>(`/api/evidence/versions/${encodeURIComponent(versionId)}/approve`, body, { companyId, csrfToken });
}

export function rejectEvidenceVersion(
  companyId: string,
  csrfToken: string | null,
  versionId: string,
  body: { reason: string; reviewNote?: string },
) {
  return apiClient.post<EvidenceItem>(`/api/evidence/versions/${encodeURIComponent(versionId)}/reject`, body, { companyId, csrfToken });
}

export function archiveEvidence(companyId: string, csrfToken: string | null, evidenceId: string, reason?: string) {
  return apiClient.delete<EvidenceItem>(`/api/evidence/${encodeURIComponent(evidenceId)}`, { reason }, { companyId, csrfToken });
}
