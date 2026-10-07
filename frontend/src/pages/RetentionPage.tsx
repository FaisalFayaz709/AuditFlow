import { FormEvent, useState } from 'react';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { useApiResource } from '../lib/use-api-resource';
import {
  approveDeletionRequest,
  cancelDeletionRequest,
  createDeletionRequest,
  createLegalHold,
  getRetentionPolicy,
  listDeletionRequests,
  listLegalHolds,
  releaseLegalHold,
  runDueDeletionRequests,
} from '../features/retention/retention-api';

const entityTypes = ['EVIDENCE_ITEM', 'REPORT', 'AI_ANALYSIS'];

export function RetentionPage() {
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const policy = useApiResource(() => activeCompanyId ? getRetentionPolicy(activeCompanyId) : Promise.resolve(null), [activeCompanyId]);
  const deletionRequests = useApiResource(() => activeCompanyId ? listDeletionRequests(activeCompanyId) : Promise.resolve({ items: [], pagination: { total: 0 } }), [activeCompanyId]);
  const legalHolds = useApiResource(() => activeCompanyId ? listLegalHolds(activeCompanyId) : Promise.resolve({ items: [], pagination: { total: 0 } }), [activeCompanyId]);
  const [entityType, setEntityType] = useState('EVIDENCE_ITEM');
  const [entityId, setEntityId] = useState('');
  const [reason, setReason] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    await deletionRequests.reload();
    await legalHolds.reload();
  }

  async function submitDeletionRequest(event: FormEvent) {
    event.preventDefault();
    if (!activeCompanyId) return;
    await createDeletionRequest(activeCompanyId, csrfToken, {
      entityType,
      entityId,
      reason,
      backupLimitationAcknowledged: true,
    });
    setEntityId('');
    setReason('');
    setMessage('Deletion request created and the archive-first policy was applied where supported.');
    await refresh();
  }

  async function submitLegalHold(event: FormEvent) {
    event.preventDefault();
    if (!activeCompanyId) return;
    await createLegalHold(activeCompanyId, csrfToken, entityId ? { entityType, entityId, reason: holdReason } : { reason: holdReason });
    setHoldReason('');
    setMessage('Legal hold placed. Matching purge workflow is blocked until released.');
    await refresh();
  }

  if (!activeCompanyId) return <section className="page"><h2>Retention</h2><p>Select a company context first.</p></section>;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Retention governance</p>
          <h2>Retention, Deletion, and Legal Hold</h2>
          <p>Policy-controlled purge workflow with archive-first handling, backup-limitation acknowledgement, separate approval, waiting period, legal-hold blocking, background execution, and audit events.</p>
        </div>
        <button type="button" onClick={() => void runDueDeletionRequests(activeCompanyId, csrfToken).then(refresh)}>Run due purge job</button>
      </header>

      {message ? <p className="success-text">{message}</p> : null}

      <section className="card" aria-labelledby="retention-policy-heading">
        <h3 id="retention-policy-heading">Retention policy disclosure</h3>
        {policy.loading ? <p>Loading policy…</p> : policy.error ? <p className="error-text">{String(policy.error)}</p> : policy.data ? (
          <div>
            <p><strong>Policy version:</strong> {policy.data.policyVersion}</p>
            <p><strong>Minimum purge wait:</strong> {policy.data.minimumPurgeWaitDays} days after approval.</p>
            <p><strong>Backup limitation:</strong> {policy.data.backupLimitationDisclosure}</p>
            <p><strong>Protected accountability records:</strong> {policy.data.protectedAccountabilityRecords.join(', ')}</p>
            <p><strong>Requester self-approval:</strong> Not allowed.</p>
          </div>
        ) : null}
      </section>

      <div className="grid-two">
        <form className="card form-stack" onSubmit={(event) => void submitDeletionRequest(event)}>
          <h3>Create deletion request</h3>
          <label className="field"><span>Entity type</span><select value={entityType} onChange={(event) => setEntityType(event.target.value)}>{entityTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="field"><span>Entity ID</span><input value={entityId} onChange={(event) => setEntityId(event.target.value)} required /></label>
          <label className="field"><span>Reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
          <p className="small-note">Submitting acknowledges the backup limitation above and applies archive-first handling before any permanent purge can be approved.</p>
          <button type="submit">Request deletion</button>
        </form>

        <form className="card form-stack" onSubmit={(event) => void submitLegalHold(event)}>
          <h3>Place legal hold</h3>
          <label className="field"><span>Entity type</span><select value={entityType} onChange={(event) => setEntityType(event.target.value)}>{entityTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="field"><span>Entity ID</span><input value={entityId} onChange={(event) => setEntityId(event.target.value)} placeholder="leave blank only for company-wide hold" /></label>
          <label className="field"><span>Reason</span><textarea value={holdReason} onChange={(event) => setHoldReason(event.target.value)} required /></label>
          <button type="submit">Place legal hold</button>
        </form>
      </div>

      <section className="card">
        <h3>Deletion requests</h3>
        {deletionRequests.loading ? <p>Loading…</p> : deletionRequests.error ? <p className="error-text">{String(deletionRequests.error)}</p> : (
          <div className="table-wrap"><table><thead><tr><th>Entity</th><th>Status</th><th>Execute after</th><th>Actions</th></tr></thead><tbody>{deletionRequests.data?.items.map((item) => <tr key={item.id}><td>{item.entityType}<br /><small>{item.entityId}</small></td><td>{item.status}<br /><small>{item.policyVersion}</small></td><td>{item.executeAfter ?? 'Not scheduled'}<br /><small>{item.backupLimitationDisclosure}</small></td><td><button type="button" onClick={() => void approveDeletionRequest(activeCompanyId, csrfToken, item.id).then(refresh)}>Approve</button><button type="button" onClick={() => void cancelDeletionRequest(activeCompanyId, csrfToken, item.id).then(refresh)}>Cancel</button></td></tr>)}</tbody></table></div>
        )}
      </section>

      <section className="card">
        <h3>Legal holds</h3>
        {legalHolds.loading ? <p>Loading…</p> : legalHolds.error ? <p className="error-text">{String(legalHolds.error)}</p> : (
          <div className="table-wrap"><table><thead><tr><th>Scope</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead><tbody>{legalHolds.data?.items.map((item) => <tr key={item.id}><td>{item.entityType ?? 'COMPANY'}<br /><small>{item.entityId ?? 'all entities'}</small></td><td>{item.reason}</td><td>{item.releasedAt ? 'Released' : 'Active'}</td><td>{item.releasedAt ? null : <button type="button" onClick={() => void releaseLegalHold(activeCompanyId, csrfToken, item.id).then(refresh)}>Release</button>}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </section>
  );
}
