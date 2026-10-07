import { apiClient } from '../../lib/api-client';
import type { EvidenceMapping } from '../../types/api';

export function listMappings(companyId: string, versionId: string) {
  return apiClient.get<{ items: EvidenceMapping[] }>(`/api/evidence/versions/${encodeURIComponent(versionId)}/mappings`, { companyId });
}

export function createManualMapping(
  companyId: string,
  csrfToken: string | null,
  versionId: string,
  body: { controlId: string; requirementId: string; reason?: string },
) {
  return apiClient.post<EvidenceMapping>(`/api/evidence/versions/${encodeURIComponent(versionId)}/mappings`, body, { companyId, csrfToken });
}

export function approveMapping(companyId: string, csrfToken: string | null, mappingId: string, reviewNote?: string) {
  return apiClient.post<EvidenceMapping>(`/api/mappings/${encodeURIComponent(mappingId)}/approve`, { reviewNote }, { companyId, csrfToken });
}

export function rejectMapping(companyId: string, csrfToken: string | null, mappingId: string, reason: string, reviewNote?: string) {
  return apiClient.post<EvidenceMapping>(`/api/mappings/${encodeURIComponent(mappingId)}/reject`, { reason, reviewNote }, { companyId, csrfToken });
}
