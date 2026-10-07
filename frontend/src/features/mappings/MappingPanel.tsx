import { useState, type FormEvent } from 'react';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '../../components/ui/AsyncStates';
import { Field, FormActions } from '../../components/ui/Forms';
import { MappingReviewBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { useApiResource } from '../../lib/use-api-resource';
import { useCompanyContext } from '../companies/CompanyContext';
import { approveMapping, createManualMapping, listMappings, rejectMapping } from './mappings-api';

export function MappingPanel({ versionId }: { versionId: string }) {
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const mappings = useApiResource(() => listMappings(activeCompanyId, versionId), [activeCompanyId, versionId]);
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
      await createManualMapping(activeCompanyId, csrfToken, versionId, {
        controlId: String(form.get('controlId') ?? '').trim(),
        requirementId: String(form.get('requirementId') ?? '').trim(),
        reason: String(form.get('reason') ?? '').trim() || undefined,
      });
      event.currentTarget.reset();
      setSuccess('Manual mapping created for human review. It will not affect readiness until approved.');
      await mappings.reload();
    } catch (createError) {
      setError(createError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(mappingId: string) {
    setError(null);
    setSuccess(null);
    try {
      await approveMapping(activeCompanyId, csrfToken, mappingId, 'Approved from mapping review UI.');
      setSuccess('Mapping approved. It can satisfy readiness only if evidence is approved and valid.');
      await mappings.reload();
    } catch (approveError) {
      setError(approveError);
    }
  }

  async function handleReject(mappingId: string) {
    const reason = window.prompt('Reason for rejecting this mapping?');
    if (!reason) return;
    setError(null);
    setSuccess(null);
    try {
      await rejectMapping(activeCompanyId, csrfToken, mappingId, reason);
      setSuccess('Mapping rejected.');
      await mappings.reload();
    } catch (rejectError) {
      setError(rejectError);
    }
  }

  return (
    <section className="card">
      <h3>Evidence mappings</h3>
      <p className="small-note">Mappings are reviewed separately from evidence approval. Suggested/pending mappings do not affect readiness.</p>
      {mappings.loading ? <LoadingState label="Loading mappings…" /> : null}
      {mappings.error ? <ErrorState error={mappings.error} /> : null}
      {mappings.data?.items.length === 0 ? <EmptyState title="No mappings for this version" /> : null}
      {mappings.data?.items.map((mapping) => (
        <article className="resource-card" key={mapping.id}>
          <div>
            <h4>{mapping.control?.code ?? 'Control'} → {mapping.requirement?.code ?? 'Requirement'}</h4>
            <p>{mapping.requirement?.name ?? mapping.reason ?? 'No mapping reason available.'}</p>
            <div className="badge-row">
              <MappingReviewBadge status={mapping.status} />
              <StatusBadge label={mapping.source} tone="info" />
              {mapping.ai_confidence !== null && mapping.ai_confidence !== undefined ? <StatusBadge label={`AI confidence ${mapping.ai_confidence}`} tone="neutral" /> : null}
            </div>
          </div>
          <div className="button-stack">
            <button type="button" onClick={() => void handleApprove(mapping.id)} disabled={mapping.status === 'APPROVED'}>
              Approve mapping
            </button>
            <button type="button" className="secondary-button" onClick={() => void handleReject(mapping.id)} disabled={mapping.status === 'REJECTED'}>
              Reject mapping
            </button>
          </div>
        </article>
      ))}

      <form className="form-grid" onSubmit={(event) => void handleCreate(event)}>
        <Field label="Control ID" htmlFor="mapping-control-id">
          <input id="mapping-control-id" name="controlId" required />
        </Field>
        <Field label="Requirement ID" htmlFor="mapping-requirement-id">
          <input id="mapping-requirement-id" name="requirementId" required />
        </Field>
        <Field label="Reason" htmlFor="mapping-reason">
          <textarea id="mapping-reason" name="reason" />
        </Field>
        <FormActions>
          <button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create manual mapping'}</button>
        </FormActions>
      </form>
      {success ? <SuccessNotice>{success}</SuccessNotice> : null}
      {error ? <ErrorState error={error} /> : null}
    </section>
  );
}
