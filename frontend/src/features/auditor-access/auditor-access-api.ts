import { apiClient } from '../../lib/api-client';

export type AuditorScopeType = 'FRAMEWORK' | 'CONTROL' | 'EVIDENCE_ITEM' | 'EVIDENCE_VERSION' | 'REPORT';

export type AuditorAccessGrant = {
  id: string;
  companyId: string;
  auditorMemberId: string;
  scopeType: AuditorScopeType;
  scopeId: string;
  startsAt: string;
  expiresAt: string;
  downloadAllowed: boolean;
  grantedByUserId: string;
  revokedAt: string | null;
  createdAt: string;
};

export type GrantListResponse = {
  items: AuditorAccessGrant[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
};

export type CreateAuditorGrantInput = {
  auditorMemberId: string;
  scopeType: AuditorScopeType;
  scopeId: string;
  expiresAt: string;
  startsAt?: string;
  downloadAllowed: boolean;
};

export function listAuditorGrants(companyId: string) {
  return apiClient.get<GrantListResponse>('/api/auditor-access/grants', { companyId });
}

export function listMyAuditorGrants(companyId: string) {
  return apiClient.get<{ items: AuditorAccessGrant[] }>('/api/auditor-access/my-grants', { companyId });
}

export function createAuditorGrant(companyId: string, csrfToken: string | null, body: CreateAuditorGrantInput) {
  return apiClient.post<AuditorAccessGrant>('/api/auditor-access/grants', body, { companyId, csrfToken });
}

export function revokeAuditorGrant(companyId: string, csrfToken: string | null, grantId: string) {
  return apiClient.delete<AuditorAccessGrant>(`/api/auditor-access/grants/${grantId}`, undefined, { companyId, csrfToken });
}


export type AuditorViewControl = { id: string; code: string; title: string; scopeType?: AuditorScopeType; grantExpiresAt?: string };
export type AuditorViewEvidence = { id: string; title: string; versionId?: string; status: string; sensitivityLevel?: string; grantExpiresAt?: string; downloadAllowed?: boolean };
export type AuditorViewReport = { id: string; type: string; schemaVersion: string; status: string; generatedAt?: string; grantExpiresAt?: string; downloadAllowed?: boolean };

export function listAuditorViewControls(companyId: string) {
  return apiClient.get<{ items: AuditorViewControl[] }>('/api/auditor-view/controls', { companyId });
}

export function listAuditorViewEvidence(companyId: string) {
  return apiClient.get<{ items: AuditorViewEvidence[] }>('/api/auditor-view/evidence', { companyId });
}

export function listAuditorViewReports(companyId: string) {
  return apiClient.get<{ items: AuditorViewReport[] }>('/api/auditor-view/reports', { companyId });
}
