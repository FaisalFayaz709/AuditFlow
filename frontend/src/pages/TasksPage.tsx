import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '../components/ui/AsyncStates';
import { Field, FormActions } from '../components/ui/Forms';
import { StatusBadge, TaskCompletionBadge } from '../components/ui/StatusBadge';
import { WorkflowStatusBoundary } from '../features/tasks/components/WorkflowStatusBoundary';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { createTask, listTasks } from '../features/tasks/tasks-api';
import { useApiResource } from '../lib/use-api-resource';

export function TasksPage() {
  const [searchParams] = useSearchParams();
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const tasks = useApiResource(() => listTasks(activeCompanyId, query), [activeCompanyId, query]);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    try {
      await createTask(activeCompanyId, csrfToken, {
        companyControlId: String(form.get('companyControlId') ?? '').trim(),
        requirementId: String(form.get('requirementId') ?? '').trim() || undefined,
        assignedToUserId: String(form.get('assignedToUserId') ?? '').trim() || undefined,
        title: String(form.get('title') ?? '').trim(),
        description: String(form.get('description') ?? '').trim() || undefined,
        priority: String(form.get('priority') ?? 'MEDIUM'),
        dueDate: String(form.get('dueDate') ?? '').trim() || undefined,
        administrativeOnly: form.get('administrativeOnly') === 'on',
      });
      event.currentTarget.reset();
      setSuccess('Task created. Evidence and mapping approval remain separate workflows.');
      await tasks.reload();
    } catch (createError) {
      setError(createError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Tasks</p>
          <h2>Evidence request tasks</h2>
          <p>Task completion means the requested submission was accepted. It does not approve evidence or mappings; overdue is derived from due date plus non-terminal task status.</p>
        </div>
        <div className="header-actions">
          <a href="#create-task" className="button-link">Create task</a>
        </div>
      </header>

      <section id="create-task" className="card">
        <h3>Create task</h3>
        <form className="form-grid" onSubmit={(event) => void handleCreate(event)}>
          <Field label="Company control ID" htmlFor="task-control-id">
            <input id="task-control-id" name="companyControlId" required />
          </Field>
          <Field label="Requirement ID" htmlFor="task-requirement-id">
            <input id="task-requirement-id" name="requirementId" />
          </Field>
          <Field label="Assigned user ID" htmlFor="task-assignee-id">
            <input id="task-assignee-id" name="assignedToUserId" />
          </Field>
          <Field label="Title" htmlFor="task-title">
            <input id="task-title" name="title" required />
          </Field>
          <Field label="Description" htmlFor="task-description">
            <textarea id="task-description" name="description" />
          </Field>
          <Field label="Priority" htmlFor="task-priority">
            <select id="task-priority" name="priority" defaultValue="MEDIUM">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </Field>
          <Field label="Due date" htmlFor="task-due-date">
            <input id="task-due-date" name="dueDate" type="date" />
          </Field>
          <label className="checkbox-field">
            <input name="administrativeOnly" type="checkbox" /> Administrative-only task
          </label>
          <FormActions>
            <button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create task'}</button>
          </FormActions>
        </form>
        {success ? <SuccessNotice>{success}</SuccessNotice> : null}
        {error ? <ErrorState error={error} /> : null}
      </section>

      {tasks.loading ? <LoadingState label="Loading tasks…" /> : null}
      {tasks.error ? <ErrorState error={tasks.error} /> : null}
      {tasks.data?.items.length === 0 ? <EmptyState title="No tasks found" /> : null}
      <div className="resource-list">
        {tasks.data?.items.map((task) => (
          <article className="resource-card" key={task.id}>
            <div>
              <h3>{task.title}</h3>
              <p>{task.description ?? task.company_control?.control.title ?? 'No description'}</p>
              <div className="badge-row">
                <TaskCompletionBadge status={task.status} />
                <StatusBadge label={task.priority} tone="warning" />
                {task.due_date ? <StatusBadge label={`Due ${new Date(task.due_date).toLocaleDateString()}`} tone="info" /> : null}
                {task.overdue ? <StatusBadge label="Overdue: Yes" tone="danger" /> : null}
              </div>
              <WorkflowStatusBoundary task={task} />
            </div>
            <Link to={`/tasks/${task.id}`}>Open task</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
