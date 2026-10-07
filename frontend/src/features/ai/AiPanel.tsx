import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '../../components/ui/AsyncStates';
import { useCompanyContext } from '../companies/CompanyContext';
import { listAiAnalyses, runAiAnalysis } from './ai-api';
import { useApiResource } from '../../lib/use-api-resource';

export function AiPanel({ versionId }: { versionId: string }) {
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const analyses = useApiResource(() => listAiAnalyses(activeCompanyId, versionId), [activeCompanyId, versionId]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await runAiAnalysis(activeCompanyId, csrfToken, versionId);
      setSuccess(`AI analysis ${result.analysis.status.toLowerCase()}; ${result.suggestedMappingCount} suggested mapping(s) created for human review.`);
      await analyses.reload();
    } catch (runError) {
      setError(runError);
    } finally {
      setRunning(false);
    }
  }

  const items = analyses.data?.items ?? [];

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h3>AI analysis</h3>
          <p>Optional advisory analysis. AI suggestions never approve evidence, mappings, or readiness.</p>
        </div>
        <button type="button" onClick={() => void handleRun()} disabled={running}>
          {running ? 'Running…' : 'Run AI analysis'}
        </button>
      </div>
      {success ? <SuccessNotice>{success}</SuccessNotice> : null}
      {error ? <ErrorState error={error} /> : null}
      {analyses.loading ? <LoadingState label="Loading AI analyses…" /> : null}
      {analyses.error ? <ErrorState error={analyses.error} /> : null}
      {!analyses.loading && !items.length ? <EmptyState title="No AI analyses yet" description="Run analysis after text extraction is available or use the metadata-only mock path for local development." /> : null}
      {items.length ? (
        <div className="resource-list compact">
          {items.map((analysis) => (
            <article className="compact-row" key={analysis.id}>
              <div>
                <strong>{analysis.document_type ?? 'OTHER'} — {analysis.status}</strong>
                <small>{analysis.summary ?? analysis.error_message ?? 'No summary'}</small>
              </div>
              <small>{analysis.provider}/{analysis.model_name} · {analysis.prompt_version}</small>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}