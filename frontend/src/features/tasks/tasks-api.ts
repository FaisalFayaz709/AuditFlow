import { apiClient } from '../../lib/api-client';
import type { Task } from '../../types/api';

export function listTasks(companyId: string, query = '') {
  return apiClient.get<{ items: Task[] }>(`/api/tasks${query}`, { companyId });
}

export function getTask(companyId: string, taskId: string) {
  return apiClient.get<Task>(`/api/tasks/${encodeURIComponent(taskId)}`, { companyId });
}

export function createTask(
  companyId: string,
  csrfToken: string | null,
  body: {
    companyControlId: string;
    requirementId?: string;
    assignedToUserId?: string;
    title: string;
    description?: string;
    priority: string;
    dueDate?: string;
    administrativeOnly: boolean;
  },
) {
  return apiClient.post<Task>('/api/tasks', body, { companyId, csrfToken });
}

export function startTask(companyId: string, csrfToken: string | null, taskId: string) {
  return apiClient.post<Task>(`/api/tasks/${encodeURIComponent(taskId)}/start`, {}, { companyId, csrfToken });
}

export function submitTaskEvidence(companyId: string, csrfToken: string | null, taskId: string, evidenceVersionId: string) {
  return apiClient.post<Task>(`/api/tasks/${encodeURIComponent(taskId)}/submit-evidence`, { evidenceVersionId }, { companyId, csrfToken });
}

export function completeTask(companyId: string, csrfToken: string | null, taskId: string, reviewNote?: string) {
  return apiClient.post<Task>(`/api/tasks/${encodeURIComponent(taskId)}/complete`, { reviewNote }, { companyId, csrfToken });
}

export function rejectTask(companyId: string, csrfToken: string | null, taskId: string, reason: string) {
  return apiClient.post<Task>(`/api/tasks/${encodeURIComponent(taskId)}/reject`, { reason }, { companyId, csrfToken });
}

export function cancelTask(companyId: string, csrfToken: string | null, taskId: string, reason: string) {
  return apiClient.post<Task>(`/api/tasks/${encodeURIComponent(taskId)}/cancel`, { reason }, { companyId, csrfToken });
}
