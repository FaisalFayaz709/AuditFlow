import { apiClient } from '../../lib/api-client';
import type { AiAnalysisListResponse, AiAnalysisRunResponse, AiSettings } from '../../types/api';

export function getAiSettings(companyId: string | null) {
  return apiClient.get<AiSettings>('/api/companies/current/ai-settings', { companyId });
}

export function updateAiSettings(companyId: string | null, csrfToken: string | null, body: AiSettings) {
  return apiClient.patch<AiSettings>('/api/companies/current/ai-settings', body, { companyId, csrfToken });
}

export function listAiAnalyses(companyId: string | null, versionId: string) {
  return apiClient.get<AiAnalysisListResponse>(`/api/evidence/versions/${versionId}/ai-analyses`, { companyId });
}

export function runAiAnalysis(companyId: string | null, csrfToken: string | null, versionId: string) {
  return apiClient.post<AiAnalysisRunResponse>(`/api/evidence/versions/${versionId}/run-ai-analysis`, undefined, { companyId, csrfToken });
}
