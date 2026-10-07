import { apiClient } from '../../lib/api-client';
import type { CompanyControl } from '../../types/api';

export function listControls(companyId: string) {
  return apiClient.get<{ items: CompanyControl[] }>('/api/controls', { companyId });
}

export function getControl(companyId: string, controlId: string) {
  return apiClient.get<CompanyControl>(`/api/controls/${encodeURIComponent(controlId)}`, { companyId });
}

export function updateControlState(
  companyId: string,
  csrfToken: string | null,
  controlId: string,
  body: { applicability?: 'APPLICABLE' | 'NOT_APPLICABLE'; notApplicableReason?: string; ownerUserId?: string | null },
) {
  return apiClient.patch<CompanyControl>(`/api/controls/${encodeURIComponent(controlId)}/company-state`, body, { companyId, csrfToken });
}
