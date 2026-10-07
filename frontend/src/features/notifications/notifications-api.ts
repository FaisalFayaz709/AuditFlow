import { apiFetch } from '../../lib/api-client';

export type NotificationSummary = {
  id: string;
  type: string;
  preference_category?: string;
  subject: string;
  body: string;
  action_url?: string | null;
  status: string;
  entity_type?: string | null;
  entity_id?: string | null;
  read_at?: string | null;
  created_at: string;
};

export type NotificationPreference = {
  id?: string;
  category: 'ACCOUNT_SECURITY' | 'INVITATION' | 'WORKFLOW' | 'REMINDER' | 'REPORT' | 'AI' | 'AUDITOR_ACCESS';
  type?: string | null;
  channel: 'EMAIL';
  enabled: boolean;
};

export type NotificationPreferencesResponse = {
  contractVersion: string;
  mandatoryTypes: string[];
  catalog: Array<{ type: string; category: NotificationPreference['category']; mandatory: boolean }>;
  preferences: NotificationPreference[];
};

export async function listNotifications(companyId: string) {
  return apiFetch<{ items: NotificationSummary[] }>(`/api/notifications?limit=10`, { companyId });
}

export async function markNotificationRead(companyId: string, csrfToken: string | null, id: string) {
  return apiFetch<NotificationSummary>(`/api/notifications/${id}/read`, {
    method: 'POST',
    companyId,
    csrfToken,
  });
}

export async function listNotificationPreferences(companyId: string) {
  return apiFetch<NotificationPreferencesResponse>('/api/notifications/preferences', { companyId });
}

export async function updateNotificationPreferences(companyId: string, csrfToken: string | null, preferences: NotificationPreference[]) {
  return apiFetch<{ contractVersion: string; preferences: NotificationPreference[] }>('/api/notifications/preferences', {
    method: 'PATCH',
    companyId,
    csrfToken,
    body: JSON.stringify({ preferences }),
  });
}
