import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '../components/ui/AsyncStates';
import { Field, FormActions } from '../components/ui/Forms';
import { EvidenceReviewBadge, StatusBadge, TaskCompletionBadge } from '../components/ui/StatusBadge';
import { CommentsPanel } from '../features/comments/CommentsPanel';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { WorkflowStatusBoundary } from '../features/tasks/components/WorkflowStatusBoundary';
import { canCancelTask, canCompleteTask, canRejectTask, canStartTask, canSubmitEvidenceToTask } from '../features/tasks/task-status-ui';
import { cancelTask, completeTask, getTask, rejectTask, startTask, submitTaskEvidence } from '../features/tasks/tasks-api';
import { useApiResource } from '../lib/use-api-resource';

export function TaskDetailPage() {
  const { taskId = '' } = useParams();
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const task = useApiResource(() => getTask(activeCompanyId, taskId), [activeCompanyId, taskId]);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function withAction(action: () => Promise<unknown>, message: string) {
    setError(null);
    setSuccess(null);
    try {
      await action();
      setSuccess(message);
      await task.reload();
    } catch (actionError) {
      setError(actionError);
    }
  }

  function handleSubmitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const evidenceVersionId = String(form.get('evidenceVersionId') ?? '').trim();
    void withAction(
      () => submitTaskEvidence(activeCompanyId, csrfToken, taskId, evidenceVersionId),
      'Evidence submitted to task. Evidence review and mapping review remain separate.',
    );
  }

  return (
    <section className="page-stack">
      <p className="eyebrow">Task detail</p>
      <Link to="/tasks">← Back to tasks</Link>
      {task.loading ? <LoadingState label="Loading task…" /> : null}
      {task.error ? <ErrorState error={task.error} /> : null}
      {task.data ? (
        <>
          <header className="detail-header">
            <div>
              <h2>{task.data.title}</h2>
              <p>{task.data.description ?? task.data.company_control?.control.title ?? 'No description'}</p>
            </div>
            <div className="badge-row">
              <TaskCompletionBadge status={task.data.status} />
              <StatusBadge label={task.data.priority} tone="warning" />
              {task.data.due_date ? <StatusBadge label={`Due ${new Date(task.data.due_date).toLocaleDateString()}`} tone="info" /> : null}
              {task.data.overdue ? <StatusBadge label="Overdue: Yes" tone="danger" /> : null}
            </div>
          </header>

          <section className="card">
            <h3>Separate review states</h3>
            <WorkflowStatusBoundary task={task.data} />
            <p className="small-note">Completing this task records only task completion. Evidence approval and mapping approval must be performed in their own review workflows.</p>
          </section>

          <section className="card">
            <h3>Submitted evidence</h3>
            {task.data.task_evidence?.length ? (
              task.data.task_evidence.map((submitted) => (
                <article className="compact-row" key={submitted.id}>
                  <div>
                    <strong>{submitted.evidence_version.evidence_item?.title ?? submitted.evidence_version.file_name}</strong>
                    <small>Version {submitted.evidence_version.version_no} · submitted {new Date(submitted.created_at).toLocaleString()}</small>
                  </div>
                  <EvidenceReviewBadge status={submitted.evidence_version.status} />
                </article>
              ))
            ) : (
              <EmptyState title="No evidence submitted to this task" />
            )}
          </section>

          <section className="two-column-grid">
            <form className="form-card" onSubmit={handleSubmitEvidence}>
              <h3>Submit evidence version</h3>
              <Field label="Evidence version ID" htmlFor="submit-evidence-version-id">
                <input id="submit-evidence-version-id" name="evidenceVersionId" required />
              </Field>
              <FormActions>
                <button type="submit" disabled={!canSubmitEvidenceToTask(task.data)}>Submit evidence</button>
                <button type="button" className="secondary-button" disabled={!canStartTask(task.data)} onClick={() => void withAction(() => startTask(activeCompanyId, csrfToken, taskId), 'Task started.')}>
                  Start task
                </button>
              </FormActions>
            </form>

            <div className="form-card">
              <h3>Review task submission</h3>
              <div className="button-stack">
                <button type="button" disabled={!canCompleteTask(task.data)} onClick={() => void withAction(() => completeTask(activeCompanyId, csrfToken, taskId, 'Accepted from task review UI.'), 'Task completed. Evidence/mapping review was not bypassed.')}>
                  Complete task
                </button>
                <button type="button" className="secondary-button" disabled={!canRejectTask(task.data)} onClick={() => {
                  const reason = window.prompt('Reason for rejecting this task submission?');
                  if (reason) void withAction(() => rejectTask(activeCompanyId, csrfToken, taskId, reason), 'Task rejected.');
                }}>
                  Reject task
                </button>
                <button type="button" className="danger-button" disabled={!canCancelTask(task.data)} onClick={() => {
                  const reason = window.prompt('Reason for cancelling this task?');
                  if (reason) void withAction(() => cancelTask(activeCompanyId, csrfToken, taskId, reason), 'Task cancelled.');
                }}>
                  Cancel task
                </button>
              </div>
            </div>
          </section>

          {success ? <SuccessNotice>{success}</SuccessNotice> : null}
          {error ? <ErrorState error={error} /> : null}
          <CommentsPanel entityType="TASK" entityId={task.data.id} title="Task comments" />
        </>
      ) : null}
    </section>
  );
}
