import { apiClient } from '../../lib/api-client';

export type RetentionPolicy = {
  policyVersion: string;
  archiveFirst: boolean;
  permanentPurgeRequiresRequest: boolean;
  permanentPurgeRequiresApproval: boolean;
  minimumPurgeWaitDays: number;
  legalHoldBlocksPurge: boolean;
  backupLimitationDisclosure: string;
  protectedAccountabilityRecords: string[];
  supportedPurgeTargets: string[];
  requesterMayApproveOwnRequest: false;
};

export type DeletionRequest = {
  id: string;
  entityType: string;
  entityId: string;
  reason: string;
  status: string;
  executeAfter: string | null;
  completedAt: string | null;
  failureCode: string | null;
  backupLimitationAcknowledged: boolean;
  backupLimitationDisclosure: string;
  policyVersion: string;
  createdAt: string;
};

export type LegalHold = {
  id: string;
  entityType: string | null;
  entityId: string | null;
  reason: string;
  releasedAt: string | null;
  createdAt: string;
};

export async function getRetentionPolicy(companyId: string) {
  return apiClient.get<RetentionPolicy>('/api/retention/policy', { companyId });
}

export async function listDeletionRequests(companyId: string) {
  return apiClient.get<{ items: DeletionRequest[]; pagination: { total: number } }>('/api/retention/deletion-requests', { companyId });
}

export async function createDeletionRequest(companyId: string, csrfToken: string | null, body: { entityType: string; entityId: string; reason: string; backupLimitationAcknowledged: true }) {
  return apiClient.post<DeletionRequest>('/api/retention/deletion-requests', body, { companyId, csrfToken });
}

export async function approveDeletionRequest(companyId: string, csrfToken: string | null, deletionRequestId: string) {
  return apiClient.post<DeletionRequest>(`/api/retention/deletion-requests/${deletionRequestId}/approve`, {}, { companyId, csrfToken });
}

export async function cancelDeletionRequest(companyId: string, csrfToken: string | null, deletionRequestId: string) {
  return apiClient.post<DeletionRequest>(`/api/retention/deletion-requests/${deletionRequestId}/cancel`, {}, { companyId, csrfToken });
}

export async function runDueDeletionRequests(companyId: string, csrfToken: string | null) {
  return apiClient.post<{ processed: number; items: DeletionRequest[] }>('/api/retention/deletion-requests/run-due', {}, { companyId, csrfToken });
}

export async function listLegalHolds(companyId: string) {
  return apiClient.get<{ items: LegalHold[]; pagination: { total: number } }>('/api/retention/legal-holds', { companyId });
}

export async function createLegalHold(companyId: string, csrfToken: string | null, body: { entityType?: string; entityId?: string; reason: string }) {
  return apiClient.post<LegalHold>('/api/retention/legal-holds', body, { companyId, csrfToken });
}

export async function releaseLegalHold(companyId: string, csrfToken: string | null, legalHoldId: string) {
  return apiClient.post<LegalHold>(`/api/retention/legal-holds/${legalHoldId}/release`, {}, { companyId, csrfToken });
}
