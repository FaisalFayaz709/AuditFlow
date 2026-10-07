import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '../components/ui/AsyncStates';
import { Field, FormActions } from '../components/ui/Forms';
import { EvidenceReviewBadge, StatusBadge } from '../components/ui/StatusBadge';
import { EvidencePrivacyNotice } from '../components/ui/EvidencePrivacyNotice';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { listEvidence, uploadEvidence } from '../features/evidence/evidence-api';
import { useApiResource } from '../lib/use-api-resource';

export function EvidenceVaultPage() {
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const evidence = useApiResource(() => listEvidence(activeCompanyId), [activeCompanyId]);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    try {
      await uploadEvidence(activeCompanyId, csrfToken, form);
      event.currentTarget.reset();
      setSuccess('Evidence uploaded into the private staged/finalized pipeline. Review is still required.');
      await evidence.reload();
    } catch (uploadError) {
      setError(uploadError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Evidence vault</p>
          <h2>Evidence</h2>
          <p>Private evidence objects are authorized per request. Uploaded evidence requires human review and mapping approval before readiness impact.</p>
        </div>
        <div className="header-actions">
          <a href="#upload-evidence" className="button-link">Upload evidence</a>
        </div>
      </header>
      <EvidencePrivacyNotice />

      <section id="upload-evidence" className="card">
        <h3>Upload evidence</h3>
        <form className="form-grid" onSubmit={(event) => void handleUpload(event)}>
          <Field label="File" htmlFor="evidence-file" hint="Allowed by backend policy: PDF, PNG, JPEG, CSV, TXT for MVP.">
            <input id="evidence-file" name="file" type="file" required />
          </Field>
          <Field label="Title" htmlFor="evidence-title">
            <input id="evidence-title" name="title" />
          </Field>
          <Field label="Description" htmlFor="evidence-description">
            <textarea id="evidence-description" name="description" />
          </Field>
          <Field label="Sensitivity" htmlFor="evidence-sensitivity">
            <select id="evidence-sensitivity" name="sensitivityLevel" defaultValue="INTERNAL">
              <option value="INTERNAL">Internal</option>
              <option value="CONFIDENTIAL">Confidential</option>
              <option value="RESTRICTED">Restricted</option>
            </select>
          </Field>
          <FormActions>
            <button type="submit" disabled={submitting}>{submitting ? 'Uploading…' : 'Upload evidence'}</button>
          </FormActions>
        </form>
        {success ? <SuccessNotice>{success}</SuccessNotice> : null}
        {error ? <ErrorState error={error} /> : null}
      </section>

      {evidence.loading ? <LoadingState label="Loading evidence vault…" /> : null}
      {evidence.error ? <ErrorState error={evidence.error} /> : null}
      {evidence.data?.items.length === 0 ? <EmptyState title="No evidence uploaded yet" /> : null}
      <div className="resource-list">
        {evidence.data?.items.map((item) => (
          <article className="resource-card" key={item.id}>
            <div>
              <h3>{item.title}</h3>
              <p>{item.description ?? 'No description'}</p>
              <div className="badge-row">
                <StatusBadge label={item.sensitivity_level} tone={item.sensitivity_level === 'RESTRICTED' ? 'danger' : 'neutral'} />
                <EvidenceReviewBadge status={item.latest_version?.status} />
                <StatusBadge label={`Latest v${item.latest_version?.version_no ?? 'n/a'}`} tone="info" />
              </div>
            </div>
            <Link to={`/evidence/${item.id}`}>Open evidence</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
