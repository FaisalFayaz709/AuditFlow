import { useState } from 'react';
import { ErrorState, LoadingState } from '../components/ui/AsyncStates';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { downloadReport, generateReport, listReports } from '../features/reports/reports-api';
import { useApiResource } from '../lib/use-api-resource';
import type { ReportFormat, ReportType } from '../types/api';

const reportTypes: ReportType[] = ['AUDIT_READINESS', 'MISSING_EVIDENCE', 'CONTROL_COVERAGE', 'EVIDENCE_INVENTORY'];
const reportFormats: ReportFormat[] = ['JSON', 'CSV'];

export function ReportsPage() {
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const reports = useApiResource(() => listReports(activeCompanyId), [activeCompanyId]);
  const [type, setType] = useState<ReportType>('AUDIT_READINESS');
  const [format, setFormat] = useState<ReportFormat>('JSON');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  async function onGenerate() {
    setSubmitting(true);
    setActionError(null);
    try {
      await generateReport(activeCompanyId, csrfToken, { type, format, expiringDays: 30 });
      await reports.reload();
    } catch (error) {
      setActionError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDownload(reportId: string) {
    setActionError(null);
    try {
      await downloadReport(activeCompanyId, reportId);
    } catch (error) {
      setActionError(error);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Reports</p>
          <h2>Readiness and evidence coverage reports</h2>
          <p>
            Reports use readiness and evidence coverage language only. They do not represent certification, legal compliance, or auditor approval.
          </p>
        </div>
      </header>

      <section className="card" aria-label="Generate report">
        <h3>Generate report</h3>
        <div className="form-grid">
          <label>
            Report type
            <select value={type} onChange={(event) => setType(event.target.value as ReportType)}>
              {reportTypes.map((reportType) => <option key={reportType} value={reportType}>{reportType}</option>)}
            </select>
          </label>
          <label>
            Format
            <select value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)}>
              {reportFormats.map((reportFormat) => <option key={reportFormat} value={reportFormat}>{reportFormat}</option>)}
            </select>
          </label>
        </div>
        <button type="button" onClick={() => void onGenerate()} disabled={!activeCompanyId || submitting}>
          {submitting ? 'Generating…' : 'Generate report'}
        </button>
        {!activeCompanyId ? <p className="small-note">Select a company before generating reports.</p> : null}
      </section>

      {actionError ? <ErrorState error={actionError} /> : null}
      {reports.loading ? <LoadingState label="Loading reports…" /> : null}
      {reports.error ? <ErrorState error={reports.error} /> : null}

      <section className="card">
        <h3>Generated reports</h3>
        {reports.data?.items.length === 0 ? <p>No reports generated yet.</p> : null}
        {reports.data?.items.map((report) => (
          <article className="compact-row" key={report.id}>
            <div>
              <strong>{report.type}</strong>
              <small>
                {report.format} · schema {report.schemaVersion} · generated {new Date(report.createdAt).toLocaleString()}
              </small>
              <small>{report.fileName ?? 'No file name recorded'}</small>
            </div>
            <div className="row-actions">
              <StatusBadge label={report.status} tone={report.status === 'COMPLETED' ? 'success' : 'warning'} />
              <button type="button" onClick={() => void onDownload(report.id)} disabled={report.status !== 'COMPLETED'}>
                Download
              </button>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
