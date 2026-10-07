import { useState, type FormEvent } from 'react';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '../../components/ui/AsyncStates';
import { Field, FormActions } from '../../components/ui/Forms';
import { useApiResource } from '../../lib/use-api-resource';
import type { CommentEntityType } from '../../types/api';
import { useCompanyContext } from '../companies/CompanyContext';
import { archiveComment, createComment, listComments } from './comments-api';

export function CommentsPanel({ entityType, entityId, title }: { entityType: CommentEntityType; entityId: string; title: string }) {
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const comments = useApiResource(() => listComments(activeCompanyId, entityType, entityId), [activeCompanyId, entityType, entityId]);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    try {
      await createComment(activeCompanyId, csrfToken, {
        entityType,
        entityId,
        body: String(form.get('body') ?? '').trim(),
        visibility: String(form.get('visibility') ?? 'INTERNAL'),
      });
      event.currentTarget.reset();
      setSuccess('Comment added.');
      await comments.reload();
    } catch (createError) {
      setError(createError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(commentId: string) {
    setError(null);
    setSuccess(null);
    try {
      await archiveComment(activeCompanyId, csrfToken, commentId);
      setSuccess('Comment archived.');
      await comments.reload();
    } catch (archiveError) {
      setError(archiveError);
    }
  }

  return (
    <section className="card">
      <h3>{title}</h3>
      {comments.loading ? <LoadingState label="Loading comments…" /> : null}
      {comments.error ? <ErrorState error={comments.error} /> : null}
      {comments.data?.items.length === 0 ? <EmptyState title="No comments yet" /> : null}
      {comments.data?.items.map((comment) => (
        <article className="comment-card" key={comment.id}>
          <p>{comment.body}</p>
          <small>{comment.user?.name ?? 'Unknown user'} · {new Date(comment.created_at).toLocaleString()} · {comment.visibility}</small>
          <button className="link-button" type="button" onClick={() => void handleArchive(comment.id)}>
            Archive
          </button>
        </article>
      ))}
      <form className="form-grid" onSubmit={(event) => void handleCreateComment(event)}>
        <Field label="New comment" htmlFor={`${entityType}-${entityId}-comment`}>
          <textarea id={`${entityType}-${entityId}-comment`} name="body" required minLength={1} maxLength={4000} />
        </Field>
        <Field label="Visibility" htmlFor={`${entityType}-${entityId}-visibility`}>
          <select id={`${entityType}-${entityId}-visibility`} name="visibility" defaultValue="INTERNAL">
            <option value="INTERNAL">Internal</option>
            <option value="AUDITOR">Auditor-facing</option>
          </select>
        </Field>
        <FormActions>
          <button type="submit" disabled={submitting}>{submitting ? 'Adding…' : 'Add comment'}</button>
        </FormActions>
      </form>
      {success ? <SuccessNotice>{success}</SuccessNotice> : null}
      {error ? <ErrorState error={error} /> : null}
    </section>
  );
}
