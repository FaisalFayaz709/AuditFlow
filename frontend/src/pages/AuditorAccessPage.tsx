import { useEffect, useState } from 'react';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { createAuditorGrant, listAuditorGrants, listMyAuditorGrants, revokeAuditorGrant, type AuditorAccessGrant, type AuditorScopeType } from '../features/auditor-access/auditor-access-api';
import { AsyncState } from '../components/ui/AsyncStates';
import { StatusBadge } from '../components/ui/StatusBadge';

const scopeTypes: AuditorScopeType[] = ['FRAMEWORK', 'CONTROL', 'EVIDENCE_ITEM', 'EVIDENCE_VERSION', 'REPORT'];

function defaultExpiry() {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 30);
  return next.toISOString().slice(0, 16);
}

export function AuditorAccessPage() {
  const { activeCompanyId, activeMembership, csrfToken } = useCompanyContext();
  const [grants, setGrants] = useState<AuditorAccessGrant[]>([]);
  const [myGrants, setMyGrants] = useState<AuditorAccessGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ auditorMemberId: '', scopeType: 'REPORT' as AuditorScopeType, scopeId: '', expiresAt: defaultExpiry(), downloadAllowed: true });

  const canManage = ['OWNER', 'ADMIN', 'COMPLIANCE_MANAGER'].includes(activeMembership?.role ?? '');

  async function load() {
    if (!activeCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      if (canManage) {
        const response = await listAuditorGrants(activeCompanyId);
        setGrants(response.items);
      }
      if (activeMembership?.role === 'AUDITOR') {
        const response = await listMyAuditorGrants(activeCompanyId);
        setMyGrants(response.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load auditor access grants.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, activeMembership?.role]);

  async function submit() {
    if (!activeCompanyId) return;
    const expiresAt = new Date(form.expiresAt).toISOString();
    await createAuditorGrant(activeCompanyId, csrfToken, { ...form, expiresAt });
    setForm({ auditorMemberId: '', scopeType: 'REPORT', scopeId: '', expiresAt: defaultExpiry(), downloadAllowed: true });
    await load();
  }

  async function revoke(grantId: string) {
    if (!activeCompanyId) return;
    await revokeAuditorGrant(activeCompanyId, csrfToken, grantId);
    await load();
  }

  const visibleGrants = canManage ? grants : myGrants;

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">External review</p>
          <h2>Auditor Access Grants</h2>
          <p>Time-bounded, selected, read-only access for auditor memberships.</p>
        </div>
      </header>

      <AsyncState loading={loading} error={error} empty={!loading && visibleGrants.length === 0} emptyMessage="No auditor grants to show.">
        <div className="card-grid">
          {visibleGrants.map((grant) => (
            <article key={grant.id} className="card">
              <div className="card-row">
                <strong>{grant.scopeType}</strong>
                <StatusBadge label={grant.revokedAt ? 'REVOKED' : 'ACTIVE'} tone={grant.revokedAt ? 'neutral' : 'success'} />
              </div>
              <p className="small-note">Scope: {grant.scopeId}</p>
              <p className="small-note">Auditor member: {grant.auditorMemberId}</p>
              <p className="small-note">Expires: {new Date(grant.expiresAt).toLocaleString()}</p>
              <p className="small-note">Download: {grant.downloadAllowed ? 'Allowed' : 'View only'}</p>
              {canManage && !grant.revokedAt ? (
                <button className="danger-button" type="button" onClick={() => void revoke(grant.id)}>
                  Revoke grant
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </AsyncState>

      {canManage ? (
        <section className="card form-card">
          <h3>Create auditor grant</h3>
          <label className="field">
            <span>Auditor member ID</span>
            <input value={form.auditorMemberId} onChange={(event) => setForm((current) => ({ ...current, auditorMemberId: event.target.value }))} />
          </label>
          <label className="field">
            <span>Scope type</span>
            <select value={form.scopeType} onChange={(event) => setForm((current) => ({ ...current, scopeType: event.target.value as AuditorScopeType }))}>
              {scopeTypes.map((scopeType) => (
                <option key={scopeType} value={scopeType}>{scopeType}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Scope ID</span>
            <input value={form.scopeId} onChange={(event) => setForm((current) => ({ ...current, scopeId: event.target.value }))} />
          </label>
          <label className="field">
            <span>Expires at</span>
            <input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.downloadAllowed} onChange={(event) => setForm((current) => ({ ...current, downloadAllowed: event.target.checked }))} />
            <span>Allow downloads</span>
          </label>
          <button className="primary-button" type="button" onClick={() => void submit()}>
            Create grant
          </button>
        </section>
      ) : null}
    </section>
  );
}
