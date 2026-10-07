import { apiClient } from '../../lib/api-client';
import type { Comment, CommentEntityType } from '../../types/api';

export function listComments(companyId: string, entityType: CommentEntityType, entityId: string) {
  const params = new URLSearchParams({ entityType, entityId });
  return apiClient.get<{ items: Comment[] }>(`/api/comments?${params.toString()}`, { companyId });
}

export function createComment(companyId: string, csrfToken: string | null, body: { entityType: CommentEntityType; entityId: string; body: string; visibility?: string }) {
  return apiClient.post<Comment>('/api/comments', body, { companyId, csrfToken });
}

export function updateComment(companyId: string, csrfToken: string | null, commentId: string, body: string) {
  return apiClient.patch<Comment>(`/api/comments/${encodeURIComponent(commentId)}`, { body }, { companyId, csrfToken });
}

export function archiveComment(companyId: string, csrfToken: string | null, commentId: string) {
  return apiClient.delete<Comment>(`/api/comments/${encodeURIComponent(commentId)}`, {}, { companyId, csrfToken });
}
