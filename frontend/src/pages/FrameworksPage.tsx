import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '../components/ui/AsyncStates';
import { Field } from '../components/ui/Forms';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { enableFramework, listFrameworks } from '../features/frameworks/frameworks-api';
import { useApiResource } from '../lib/use-api-resource';

function versions(framework: { versions?: Array<{ id: string; version: string; status: string; published_at?: string | null }>; framework_versions?: Array<{ id: string; version: string; status: string; published_at?: string | null }> }) {
  return framework.versions ?? framework.framework_versions ?? [];
}

export function FrameworksPage() {
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const frameworks = useApiResource(() => listFrameworks(), []);
  const [targetAuditDate, setTargetAuditDate] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function enable(versionId: string) {
    setError(null);
    setSuccess(null);
    try {
      await enableFramework(activeCompanyId, csrfToken, versionId, targetAuditDate || undefined);
      setSuccess('Framework enabled. Controls and evidence requirements were created from the immutable published version.');
    } catch (enableError) {
      setError(enableError);
    }
  }

  return (
    <section className="page-stack">
      <p className="eyebrow">Frameworks</p>
      <h2>Framework enrollment</h2>
      <p>Enable published framework versions without silently changing active audit programs. Use upgrade reconciliation for same-family upgrades.</p>
      <div className="card">
        <Field label="Target audit date" htmlFor="target-audit-date" hint="Optional; persisted in report parameters where supported.">
          <input id="target-audit-date" type="date" value={targetAuditDate} onChange={(event) => setTargetAuditDate(event.target.value)} />
        </Field>
        <p><Link to="/frameworks/upgrade">Open framework upgrade reconciliation</Link></p>
      </div>
      {success ? <SuccessNotice>{success}</SuccessNotice> : null}
      {error ? <ErrorState error={error} /> : null}
      {frameworks.loading ? <LoadingState label="Loading frameworks…" /> : null}
      {frameworks.error ? <ErrorState error={frameworks.error} /> : null}
      {frameworks.data?.items.length === 0 ? <EmptyState title="No frameworks returned" /> : null}
      <div className="resource-list">
        {frameworks.data?.items.map((framework) => (
          <article className="resource-card" key={framework.id}>
            <div>
              <h3>{framework.name}</h3>
              <p>{framework.description}</p>
              <div className="badge-row">
                {versions(framework).map((version) => (
                  <span className="workflow-badge-with-text" key={version.id}>
                    <StatusBadge label={`v${version.version} ${version.status}`} tone={version.status === 'PUBLISHED' ? 'success' : 'neutral'} />
                    <button type="button" onClick={() => void enable(version.id)}>Enable</button>
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
