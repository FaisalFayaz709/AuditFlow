import { apiClient } from '../../lib/api-client';
import type { ReportFormat, ReportListResponse, ReportSummary, ReportType } from '../../types/api';

export type GenerateReportInput = {
  type: ReportType;
  format: ReportFormat;
  companyFrameworkId?: string;
  expiringDays?: number;
};

export function listReports(companyId?: string | null) {
  return apiClient.get<ReportListResponse>('/api/reports', { companyId });
}

export function generateReport(companyId: string | null | undefined, csrfToken: string | null | undefined, input: GenerateReportInput) {
  return apiClient.post<ReportSummary>('/api/reports', input, {
    companyId,
    csrfToken,
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
}

export async function downloadReport(companyId: string | null | undefined, reportId: string) {
  const result = await apiClient.download(`/api/reports/${reportId}/download`, { companyId });
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
