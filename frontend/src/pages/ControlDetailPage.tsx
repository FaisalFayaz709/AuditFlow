import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '../components/ui/AsyncStates';
import { Field, FormActions } from '../components/ui/Forms';
import { StatusBadge } from '../components/ui/StatusBadge';
import { CommentsPanel } from '../features/comments/CommentsPanel';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { getControl, updateControlState } from '../features/controls/controls-api';
import { useApiResource } from '../lib/use-api-resource';

export function ControlDetailPage() {
  const { controlId = '' } = useParams();
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const control = useApiResource(() => getControl(activeCompanyId, controlId), [activeCompanyId, controlId]);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleStateUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    const applicability = String(form.get('applicability')) as 'APPLICABLE' | 'NOT_APPLICABLE';
    const ownerUserIdRaw = String(form.get('ownerUserId') ?? '').trim();
    const notApplicableReason = String(form.get('notApplicableReason') ?? '').trim();

    try {
      await updateControlState(activeCompanyId, csrfToken, controlId, {
        applicability,
        ownerUserId: ownerUserIdRaw || undefined,
        notApplicableReason: applicability === 'NOT_APPLICABLE' ? notApplicableReason : undefined,
      });
      setSuccess('Control state updated. Applicability and owner changes are audited.');
      await control.reload();
    } catch (updateError) {
      setError(updateError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-stack">
      <p className="eyebrow">Control detail</p>
      <Link to="/controls">← Back to controls</Link>
      {control.loading ? <LoadingState label="Loading control…" /> : null}
      {control.error ? <ErrorState error={control.error} /> : null}
      {control.data ? (
        <>
          <header className="detail-header">
            <div>
              <h2>{control.data.control?.code} — {control.data.control?.title}</h2>
              <p>{control.data.control?.description}</p>
            </div>
            <div className="badge-row">
              <StatusBadge label={control.data.applicability} tone={control.data.applicability === 'APPLICABLE' ? 'success' : 'neutral'} />
              <StatusBadge label={control.data.control?.risk_level ?? 'Risk unknown'} tone="warning" />
              <StatusBadge label={control.data.control?.control_type ?? 'Type unknown'} tone="info" />
            </div>
          </header>

          <section className="card">
            <h3>Evidence requirements</h3>
            {control.data.control?.evidence_requirements?.length ? (
              <div className="resource-list compact">
                {control.data.control.evidence_requirements.map((requirement) => (
                  <article className="compact-row" key={requirement.id}>
                    <div>
                      <strong>{requirement.code} — {requirement.name}</strong>
                      <small>{requirement.description ?? 'No description'}</small>
                    </div>
                    <StatusBadge label={requirement.required ? 'Required' : 'Optional'} tone={requirement.required ? 'warning' : 'neutral'} />
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No requirements">Informational controls may have no required requirements.</EmptyState>
            )}
          </section>

          <section className="card">
            <h3>Applicability and owner</h3>
            <form className="form-grid" onSubmit={(event) => void handleStateUpdate(event)}>
              <Field label="Applicability" htmlFor="control-applicability">
                <select id="control-applicability" name="applicability" defaultValue={control.data.applicability}>
                  <option value="APPLICABLE">APPLICABLE</option>
                  <option value="NOT_APPLICABLE">NOT_APPLICABLE</option>
                </select>
              </Field>
              <Field label="Owner user ID" htmlFor="control-owner" hint="Must be an active member when supplied.">
                <input id="control-owner" name="ownerUserId" defaultValue={control.data.owner_user_id ?? ''} />
              </Field>
              <Field label="Not applicable reason" htmlFor="control-na-reason" hint="Required when marking NOT_APPLICABLE.">
                <textarea id="control-na-reason" name="notApplicableReason" defaultValue={control.data.not_applicable_reason ?? ''} />
              </Field>
              <FormActions>
                <button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save control state'}</button>
              </FormActions>
            </form>
            {success ? <SuccessNotice>{success}</SuccessNotice> : null}
            {error ? <ErrorState error={error} /> : null}
          </section>

          <CommentsPanel entityType="COMPANY_CONTROL" entityId={control.data.id} title="Control comments" />
        </>
      ) : null}
    </section>
  );
}
