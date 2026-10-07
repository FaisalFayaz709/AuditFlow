import { EmptyState, ErrorState, LoadingState } from '../components/ui/AsyncStates';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { listAuditorViewControls, listAuditorViewEvidence, listAuditorViewReports } from '../features/auditor-access/auditor-access-api';
import { useApiResource } from '../lib/use-api-resource';

export function AuditorViewPage() {
  const { activeCompanyId } = useCompanyContext();
  const controls = useApiResource(() => listAuditorViewControls(activeCompanyId), [activeCompanyId]);
  const evidence = useApiResource(() => listAuditorViewEvidence(activeCompanyId), [activeCompanyId]);
  const reports = useApiResource(() => listAuditorViewReports(activeCompanyId), [activeCompanyId]);

  return (
    <section className="page-stack">
      <p className="eyebrow">Auditor view</p>
      <h2>Selected read-only access</h2>
      <p>Auditors see only time-bounded granted controls, approved evidence, and completed reports. Downloads can be disabled independently from view permission.</p>
      <div className="two-column-grid">
        <section className="card">
          <h3>Granted controls</h3>
          {controls.loading ? <LoadingState label="Loading auditor controls…" /> : null}
          {controls.error ? <ErrorState error={controls.error} /> : null}
          {controls.data?.items.length === 0 ? <EmptyState title="No granted controls" /> : null}
          {controls.data?.items.map((control) => <article className="compact-row" key={control.id}><div><strong>{control.code} — {control.title}</strong><small>{control.grantExpiresAt ? `Grant expires ${new Date(control.grantExpiresAt).toLocaleString()}` : 'Grant expiry enforced by backend'}</small></div><StatusBadge label={control.scopeType ?? 'CONTROL'} tone="info" /></article>)}
        </section>
        <section className="card">
          <h3>Granted evidence</h3>
          {evidence.loading ? <LoadingState label="Loading auditor evidence…" /> : null}
          {evidence.error ? <ErrorState error={evidence.error} /> : null}
          {evidence.data?.items.length === 0 ? <EmptyState title="No granted evidence" /> : null}
          {evidence.data?.items.map((item) => <article className="compact-row" key={item.id}><div><strong>{item.title}</strong><small>{item.versionId ?? 'Version selected by grant'}</small></div><div className="badge-row"><StatusBadge label={item.status} tone={item.status === 'APPROVED' ? 'success' : 'neutral'} /><StatusBadge label={item.downloadAllowed ? 'Download allowed' : 'View only'} tone={item.downloadAllowed ? 'success' : 'warning'} /></div></article>)}
        </section>
      </div>
      <section className="card">
        <h3>Granted reports</h3>
        {reports.loading ? <LoadingState label="Loading auditor reports…" /> : null}
        {reports.error ? <ErrorState error={reports.error} /> : null}
        {reports.data?.items.length === 0 ? <EmptyState title="No granted reports" /> : null}
        {reports.data?.items.map((report) => <article className="compact-row" key={report.id}><div><strong>{report.type}</strong><small>Schema {report.schemaVersion} · {report.generatedAt ?? 'generated time not returned'}</small></div><div className="badge-row"><StatusBadge label={report.status} tone={report.status === 'COMPLETED' ? 'success' : 'neutral'} /><StatusBadge label={report.downloadAllowed ? 'Download allowed' : 'View only'} tone={report.downloadAllowed ? 'success' : 'warning'} /></div></article>)}
      </section>
    </section>
  );
}
