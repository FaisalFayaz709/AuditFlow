import { Link } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ui/AsyncStates';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ReadinessNotCalculableBanner } from '../components/ui/ReadinessNotCalculableBanner';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { getControlProgress, getDashboardOverview, getExpiringEvidence, getMissingEvidence, getOverdueTasks } from '../features/dashboard/dashboard-api';
import { useApiResource } from '../lib/use-api-resource';

export function DashboardPage() {
  const { activeCompanyId } = useCompanyContext();
  const overview = useApiResource(() => getDashboardOverview(activeCompanyId), [activeCompanyId]);
  const controlProgress = useApiResource(() => getControlProgress(activeCompanyId), [activeCompanyId]);
  const missing = useApiResource(() => getMissingEvidence(activeCompanyId), [activeCompanyId]);
  const expiring = useApiResource(() => getExpiringEvidence(activeCompanyId), [activeCompanyId]);
  const overdue = useApiResource(() => getOverdueTasks(activeCompanyId), [activeCompanyId]);

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>Readiness overview</h2>
          <p>
            Readiness is displayed as evidence coverage, not certification. Values come from approved valid evidence and approved mappings.
          </p>
        </div>
        <div className="header-actions">
          <Link to="/evidence" className="button-link">Upload evidence</Link>
          <Link to="/reports" className="secondary-action">Generate report</Link>
        </div>
      </header>
      {overview.loading ? <LoadingState label="Loading dashboard metrics…" /> : null}
      {overview.error ? <ErrorState error={overview.error} /> : null}
      {overview.data ? (
        <>
          <div className="card-grid" aria-label="Dashboard cards">
            <article className="metric-card">
              <span>Readiness</span>
              <strong>{overview.data.readinessPercent === null ? 'Not calculable' : `${overview.data.readinessPercent.toFixed(1)}%`}</strong>
              <StatusBadge label={overview.data.readinessStatus} tone={overview.data.readinessStatus === 'CALCULABLE' ? 'success' : 'warning'} />
              <Link to="/controls">Open readiness trace</Link>
            </article>
            <article className="metric-card">
              <span>Missing required evidence</span>
              <strong>{overview.data.missingRequiredEvidence}</strong>
              <Link to="/controls">Review gaps</Link>
            </article>
            <article className="metric-card">
              <span>Overdue tasks</span>
              <strong>{overview.data.overdueTasks ?? 0}</strong>
              <Link to="/tasks?overdue=true">Open tasks</Link>
            </article>
            <article className="metric-card">
              <span>Needs human review</span>
              <strong>{overview.data.needsReview}</strong>
              <small>{overview.data.evidenceVersionsNeedingReview} evidence · {overview.data.mappingsNeedingReview} mappings</small>
            </article>
            <article className="metric-card">
              <span>Expiring within {overview.data.expiringWithinDays} days</span>
              <strong>{overview.data.expiringWithinDaysCount}</strong>
            </article>
          </div>
          {overview.data.readinessStatus === 'NOT_CALCULABLE' ? <ReadinessNotCalculableBanner reason="Enable at least one applicable evidence-based control with required evidence requirements." /> : null}
          <p className="small-note">Calculated at {new Date(overview.data.calculatedAt).toLocaleString()}</p>
        </>
      ) : null}

      <div className="two-column-grid">
        <section className="card">
          <h3>Control progress</h3>
          {controlProgress.loading ? <LoadingState label="Loading controls…" /> : null}
          {controlProgress.error ? <ErrorState error={controlProgress.error} /> : null}
          {(controlProgress.data?.items ?? controlProgress.data?.controlCoverage ?? []).slice(0, 6).map((control) => (
            <article className="compact-row" key={control.companyControlId ?? control.id}>
              <div>
                <strong>{control.code ?? control.control?.code} — {control.title ?? control.control?.title}</strong>
                <small>{control.satisfiedCount ?? control.satisfiedRequiredCount ?? 0} / {control.requiredCount ?? 0} required satisfied</small>
              </div>
              <StatusBadge label={`${control.coveragePercent ?? 0}%`} tone={(control.coveragePercent ?? 0) >= 100 ? 'success' : 'warning'} />
            </article>
          ))}
        </section>
        <section className="card">
          <h3>Missing evidence</h3>
          {missing.loading ? <LoadingState label="Loading missing evidence…" /> : null}
          {missing.error ? <ErrorState error={missing.error} /> : null}
          {missing.data?.items.slice(0, 6).map((item) => (
            <article className="compact-row" key={`${item.companyControlId}-${item.requirementId}`}>
              <div>
                <strong>{item.controlCode} — {item.requirementCode}</strong>
                <small>{item.requirementName}</small>
              </div>
              <StatusBadge label={item.riskLevel} tone="warning" />
            </article>
          ))}
        </section>
      </div>

      <div className="two-column-grid">
        <section className="card">
          <h3>Expiring evidence</h3>
          {expiring.loading ? <LoadingState label="Loading expiring evidence…" /> : null}
          {expiring.error ? <ErrorState error={expiring.error} /> : null}
          {expiring.data?.items.slice(0, 6).map((item) => (
            <article className="compact-row" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <small>Current approved version: {item.current_approved_version_id ?? 'none'}</small>
              </div>
            </article>
          ))}
        </section>
        <section className="card">
          <h3>Overdue tasks</h3>
          {overdue.loading ? <LoadingState label="Loading overdue tasks…" /> : null}
          {overdue.error ? <ErrorState error={overdue.error} /> : null}
          {overdue.data?.items.slice(0, 6).map((task) => (
            <article className="compact-row" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <small>{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</small>
              </div>
              <Link to={`/tasks/${task.id}`}>Open</Link>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}
