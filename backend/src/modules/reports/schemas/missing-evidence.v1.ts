import { REPORT_SCHEMA_VERSION_V1, type VersionedReportBaseV1 } from './common.v1.js';

export const MISSING_EVIDENCE_REPORT_V1_REQUIRED_FIELDS = [
  'schemaVersion',
  'controlCode',
  'controlTitle',
  'requirementCode',
  'requirementName',
  'riskLevel',
  'ownerUserId',
  'satisfactionStatus',
  'taskStatus',
  'taskDueDate',
] as const;

export const MISSING_EVIDENCE_CSV_HEADERS_V1 = [
  'schemaVersion',
  'reportType',
  'generatedAt',
  'companyId',
  'companyFrameworkId',
  'frameworkVersionId',
  'controlId',
  'controlCode',
  'controlTitle',
  'requirementId',
  'requirementCode',
  'requirementName',
  'riskLevel',
  'ownerUserId',
  'satisfactionStatus',
  'taskStatus',
  'taskDueDate',
  'taskId',
] as const;

export type MissingEvidenceReportV1 = VersionedReportBaseV1 & {
  reportType: 'MISSING_EVIDENCE';
  readinessStatus: 'CALCULABLE' | 'NOT_CALCULABLE';
  missingEvidence: Array<{
    controlId: string;
    controlCode: string;
    controlTitle: string;
    requirementId: string;
    requirementCode: string;
    requirementName: string;
    riskLevel: string;
    ownerUserId: string | null;
    satisfactionStatus: 'MISSING_VALID_APPROVED_EVIDENCE';
    taskStatus: string | null;
    taskDueDate: string | null;
    taskId: string | null;
  }>;
};

export function assertMissingEvidenceReportV1(report: MissingEvidenceReportV1): MissingEvidenceReportV1 {
  if (report.schemaVersion !== REPORT_SCHEMA_VERSION_V1) throw new Error('MISSING_EVIDENCE report must use schemaVersion v1.');
  if (report.reportType !== 'MISSING_EVIDENCE') throw new Error('Invalid MISSING_EVIDENCE report type.');
  return report;
}
