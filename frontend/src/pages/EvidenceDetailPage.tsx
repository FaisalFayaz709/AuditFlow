import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '../components/ui/AsyncStates';
import { Field, FormActions } from '../components/ui/Forms';
import { EvidenceReviewBadge, StatusBadge } from '../components/ui/StatusBadge';
import { EvidencePrivacyNotice } from '../components/ui/EvidencePrivacyNotice';
import { CommentsPanel } from '../features/comments/CommentsPanel';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { approveEvidenceVersion, archiveEvidence, getEvidence, rejectEvidenceVersion } from '../features/evidence/evidence-api';
import { MappingPanel } from '../features/mappings/MappingPanel';
import { AiPanel } from '../features/ai/AiPanel';
import { useApiResource } from '../lib/use-api-resource';

export function EvidenceDetailPage() {
  const { evidenceId = '' } = useParams();
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const evidence = useApiResource(() => getEvidence(activeCompanyId, evidenceId), [activeCompanyId, evidenceId]);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const latestVersionId = evidence.data?.latest_version_id ?? evidence.data?.latest_version?.id ?? evidence.data?.versions?.[0]?.id;

  async function handleApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!latestVersionId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    try {
      await approveEvidenceVersion(activeCompanyId, csrfToken, latestVersionId, {
        reviewNote: String(form.get('reviewNote') ?? '').trim() || undefined,
        effectiveFrom: String(form.get('effectiveFrom') ?? '').trim() || undefined,
        effectiveUntil: String(form.get('effectiveUntil') ?? '').trim() || undefined,
        expiryDate: String(form.get('expiryDate') ?? '').trim() || undefined,
      });
      setSuccess('Evidence version approved. Mapping approval is still separate.');
      await evidence.reload();
    } catch (approveError) {
      setError(approveError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!latestVersionId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    try {
      await rejectEvidenceVersion(activeCompanyId, csrfToken, latestVersionId, {
        reason: String(form.get('reason') ?? '').trim(),
        reviewNote: String(form.get('reviewNote') ?? '').trim() || undefined,
      });
      setSuccess('Evidence version rejected. It cannot satisfy readiness.');
      await evidence.reload();
    } catch (rejectError) {
      setError(rejectError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive() {
    const reason = window.prompt('Reason for archiving this evidence item?') ?? undefined;
    setError(null);
    setSuccess(null);
    try {
      await archiveEvidence(activeCompanyId, csrfToken, evidenceId, reason);
      setSuccess('Evidence item archived. Binaries and history are retained by policy.');
      await evidence.reload();
    } catch (archiveError) {
      setError(archiveError);
    }
  }

  return (
    <section className="page-stack">
      <p className="eyebrow">Evidence detail</p>
      <Link to="/evidence">← Back to evidence</Link>
      <EvidencePrivacyNotice />
      {evidence.loading ? <LoadingState label="Loading evidence…" /> : null}
      {evidence.error ? <ErrorState error={evidence.error} /> : null}
      {evidence.data ? (
        <>
          <header className="detail-header">
            <div>
              <h2>{evidence.data.title}</h2>
              <p>{evidence.data.description ?? 'No description'}</p>
            </div>
            <div className="badge-row">
              <StatusBadge label={evidence.data.sensitivity_level} tone={evidence.data.sensitivity_level === 'RESTRICTED' ? 'danger' : 'neutral'} />
              <StatusBadge label={evidence.data.archived_at ? 'Archived' : 'Active'} tone={evidence.data.archived_at ? 'neutral' : 'success'} />
            </div>
          </header>

          <section className="card">
            <h3>Version timeline</h3>
            {evidence.data.versions?.length ? (
              <div className="resource-list compact">
                {evidence.data.versions.map((version) => (
                  <article className="compact-row" key={version.id}>
                    <div>
                      <strong>v{version.version_no} — {version.file_name}</strong>
                      <small>{version.sha256_checksum ? `SHA-256 ${version.sha256_checksum}` : 'Checksum unavailable in response'}</small>
                    </div>
                    <div className="badge-row">
                      <EvidenceReviewBadge status={version.status} />
                      <StatusBadge label={`Scan: ${version.security_scan_status ?? 'unknown'}`} tone={version.security_scan_status === 'CLEAN' ? 'success' : 'warning'} />
                      {version.expiry_date ? <StatusBadge label={`Expires ${new Date(version.expiry_date).toLocaleDateString()}`} tone="warning" /> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No version history returned" />
            )}
          </section>

          <section className="two-column-grid">
            <form className="form-card" onSubmit={(event) => void handleApprove(event)}>
              <h3>Approve latest version</h3>
              <Field label="Review note" htmlFor="approve-review-note">
                <textarea id="approve-review-note" name="reviewNote" />
              </Field>
              <Field label="Effective from" htmlFor="approve-effective-from">
                <input id="approve-effective-from" name="effectiveFrom" type="date" />
              </Field>
              <Field label="Effective until" htmlFor="approve-effective-until">
                <input id="approve-effective-until" name="effectiveUntil" type="date" />
              </Field>
              <Field label="Expiry date" htmlFor="approve-expiry-date">
                <input id="approve-expiry-date" name="expiryDate" type="date" />
              </Field>
              <FormActions>
                <button type="submit" disabled={submitting || !latestVersionId}>Approve evidence</button>
              </FormActions>
            </form>
            <form className="form-card" onSubmit={(event) => void handleReject(event)}>
              <h3>Reject latest version</h3>
              <Field label="Reason" htmlFor="reject-reason">
                <textarea id="reject-reason" name="reason" required />
              </Field>
              <Field label="Review note" htmlFor="reject-note">
                <textarea id="reject-note" name="reviewNote" />
              </Field>
              <FormActions>
                <button type="submit" className="danger-button" disabled={submitting || !latestVersionId}>Reject evidence</button>
                <button type="button" className="secondary-button" onClick={() => void handleArchive()}>Archive item</button>
              </FormActions>
            </form>
          </section>

          {success ? <SuccessNotice>{success}</SuccessNotice> : null}
          {error ? <ErrorState error={error} /> : null}

          {latestVersionId ? <AiPanel versionId={latestVersionId} /> : null}
          {latestVersionId ? <MappingPanel versionId={latestVersionId} /> : null}
          <CommentsPanel entityType="EVIDENCE_ITEM" entityId={evidence.data.id} title="Evidence comments" />
        </>
      ) : null}
    </section>
  );
}
