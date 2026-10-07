import { useState, type FormEvent } from 'react';
import { ErrorState, SuccessNotice } from '../components/ui/AsyncStates';
import { Field, FormActions } from '../components/ui/Forms';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ValidationSummary } from '../components/ui/Accessibility';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { activateFrameworkUpgrade, createFrameworkUpgradePreview, getFrameworkUpgradeReconciliation, type FrameworkUpgradeReconciliation } from '../features/frameworks/frameworks-api';

export function FrameworkUpgradePage() {
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const [draftEnrollmentId, setDraftEnrollmentId] = useState('');
  const [reconciliation, setReconciliation] = useState<FrameworkUpgradeReconciliation | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function createPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setValidationErrors([]);
    const form = new FormData(event.currentTarget);
    const enrollmentId = String(form.get('enrollmentId') ?? '').trim();
    const targetFrameworkVersionId = String(form.get('targetFrameworkVersionId') ?? '').trim();
    const errors = [];
    if (!enrollmentId) errors.push('Current active enrollment ID is required.');
    if (!targetFrameworkVersionId) errors.push('Target framework version ID is required.');
    if (errors.length) { setValidationErrors(errors); return; }
    try {
      const preview = await createFrameworkUpgradePreview(activeCompanyId, csrfToken, enrollmentId, targetFrameworkVersionId);
      setDraftEnrollmentId(preview.draftEnrollmentId);
      setSuccess('Draft reconciliation created. Compatible mappings are copied only as PENDING_REVIEW.');
      const detail = await getFrameworkUpgradeReconciliation(activeCompanyId, preview.draftEnrollmentId);
      setReconciliation(detail);
    } catch (previewError) {
      setError(previewError);
    }
  }

  async function loadDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      setReconciliation(await getFrameworkUpgradeReconciliation(activeCompanyId, draftEnrollmentId));
    } catch (loadError) {
      setError(loadError);
    }
  }

  async function activate() {
    setError(null);
    setSuccess(null);
    try {
      const result = await activateFrameworkUpgrade(activeCompanyId, csrfToken, draftEnrollmentId, { reviewed: true, reviewNote: 'Reviewed in framework reconciliation screen.' });
      setReconciliation(result);
      setSuccess('Upgrade activation requested. Backend activates the new enrollment and ends the old enrollment atomically.');
    } catch (activateError) {
      setError(activateError);
    }
  }

  return (
    <section className="page-stack">
      <p className="eyebrow">Frameworks</p>
      <h2>Upgrade reconciliation</h2>
      <p>Same-family upgrades must be reviewed before activation. Evidence mappings are not auto-approved on the new version.</p>
      <ValidationSummary errors={validationErrors} />
      {success ? <SuccessNotice>{success}</SuccessNotice> : null}
      {error ? <ErrorState error={error} /> : null}

      <div className="two-column-grid">
        <form className="form-card" onSubmit={(event) => void createPreview(event)}>
          <h3>Create upgrade preview</h3>
          <Field label="Current active enrollment ID" htmlFor="upgrade-enrollment-id"><input id="upgrade-enrollment-id" name="enrollmentId" required /></Field>
          <Field label="Target framework version ID" htmlFor="upgrade-target-version"><input id="upgrade-target-version" name="targetFrameworkVersionId" required /></Field>
          <FormActions><button type="submit">Create preview</button></FormActions>
        </form>
        <form className="form-card" onSubmit={(event) => void loadDraft(event)}>
          <h3>Load draft reconciliation</h3>
          <Field label="Draft enrollment ID" htmlFor="draft-enrollment-id"><input id="draft-enrollment-id" value={draftEnrollmentId} onChange={(event) => setDraftEnrollmentId(event.target.value)} required /></Field>
          <FormActions><button type="submit">Load reconciliation</button><button type="button" onClick={() => void activate()} disabled={!draftEnrollmentId}>Activate reviewed upgrade</button></FormActions>
        </form>
      </div>

      {reconciliation ? (
        <section className="card">
          <h3>Reconciliation summary</h3>
          <div className="badge-row">
            <StatusBadge label={`Matched ${reconciliation.matchedControls}`} tone="success" />
            <StatusBadge label={`Added ${reconciliation.addedControls}`} tone="info" />
            <StatusBadge label={`Removed ${reconciliation.removedControls}`} tone="warning" />
            <StatusBadge label={`Changed ${reconciliation.materiallyChangedControls}`} tone="warning" />
            <StatusBadge label={`Mappings copied as ${reconciliation.mappingCandidatesCopiedAs}`} tone="warning" />
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Old code</th><th>New code</th><th>Match</th><th>Proposed applicability/owner</th></tr></thead>
              <tbody>{reconciliation.controls?.map((control, index) => (
                <tr key={`${control.oldControlCode ?? 'old'}-${control.newControlCode ?? 'new'}-${index}`}>
                  <td>{control.oldControlCode ?? '—'}</td><td>{control.newControlCode ?? '—'}</td><td>{control.matchStatus}</td><td>{control.proposedApplicability ?? 'review required'}<br /><small>{control.proposedOwnerUserId ?? 'owner review required'}</small></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}
