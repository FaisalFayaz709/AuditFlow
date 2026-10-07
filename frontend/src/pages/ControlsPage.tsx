import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/AsyncStates';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { listControls } from '../features/controls/controls-api';
import { useApiResource } from '../lib/use-api-resource';

export function ControlsPage() {
  const { activeCompanyId } = useCompanyContext();
  const controls = useApiResource(() => listControls(activeCompanyId), [activeCompanyId]);

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Controls</p>
          <h2>Company controls</h2>
          <p>Manage applicability, owners, evidence requirements, and coverage without changing published framework templates.</p>
        </div>
        <div className="header-actions">
          <Link to="/frameworks" className="secondary-action">Manage frameworks</Link>
        </div>
      </header>
      {controls.loading ? <LoadingState label="Loading controls…" /> : null}
      {controls.error ? <ErrorState error={controls.error} /> : null}
      {controls.data?.items.length === 0 ? <EmptyState title="No enrolled controls">Enable a framework from Settings first.</EmptyState> : null}
      <div className="resource-list">
        {controls.data?.items.map((companyControl) => (
          <article className="resource-card" key={companyControl.id}>
            <div>
              <h3>{companyControl.control?.code} — {companyControl.control?.title}</h3>
              <p>{companyControl.control?.description}</p>
              <div className="badge-row">
                <StatusBadge label={companyControl.applicability} tone={companyControl.applicability === 'APPLICABLE' ? 'success' : 'neutral'} />
                <StatusBadge label={companyControl.control?.risk_level ?? 'Risk unknown'} tone="warning" />
                <StatusBadge label={companyControl.control?.control_type ?? 'Type unknown'} tone="info" />
              </div>
            </div>
            <Link to={`/controls/${companyControl.id}`}>Open control</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
