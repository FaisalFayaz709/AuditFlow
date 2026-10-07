import { apiClient } from '../../lib/api-client';
import type { CompanySummary } from '../../types/api';

export function getCurrentCompany(companyId: string) {
  return apiClient.get<CompanySummary>('/api/companies/current', { companyId });
}

export function updateCompany(companyId: string, csrfToken: string | null, body: { name?: string; industry?: string | null; website?: string | null }) {
  return apiClient.patch<CompanySummary>(`/api/companies/${encodeURIComponent(companyId)}`, body, { companyId, csrfToken });
}

export function listMembers(companyId: string) {
  return apiClient.get<{ items: Array<{ id: string; user_id: string; role: string; status: string; user?: { name: string; email: string } }> }>(`/api/companies/${encodeURIComponent(companyId)}/members`, { companyId });
}


export type InvitationSummary = {
  id: string;
  email: string;
  role: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED' | string;
  expires_at?: string | null;
  created_at?: string;
};

export function listInvitations(companyId: string) {
  return apiClient.get<{ items: InvitationSummary[] }>(`/api/companies/${encodeURIComponent(companyId)}/invitations`, { companyId });
}

export function createInvitation(companyId: string, csrfToken: string | null, body: { email: string; role: string }) {
  return apiClient.post<InvitationSummary>(`/api/companies/${encodeURIComponent(companyId)}/invitations`, body, { companyId, csrfToken });
}

export function resendInvitation(companyId: string, csrfToken: string | null, invitationId: string) {
  return apiClient.post<InvitationSummary>(`/api/companies/${encodeURIComponent(companyId)}/invitations/${encodeURIComponent(invitationId)}/resend`, {}, { companyId, csrfToken });
}

export function revokeInvitation(companyId: string, csrfToken: string | null, invitationId: string) {
  return apiClient.delete<InvitationSummary>(`/api/companies/${encodeURIComponent(companyId)}/invitations/${encodeURIComponent(invitationId)}`, undefined, { companyId, csrfToken });
}

export function changeMemberRole(companyId: string, csrfToken: string | null, memberId: string, role: string) {
  return apiClient.patch<{ id: string; role: string; status: string }>(`/api/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(memberId)}/role`, { role }, { companyId, csrfToken });
}

export function removeMember(companyId: string, csrfToken: string | null, memberId: string) {
  return apiClient.delete<{ id: string; status: string }>(`/api/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(memberId)}`, undefined, { companyId, csrfToken });
}
