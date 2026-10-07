import { REPORT_SCHEMA_VERSION_V1, type VersionedReportBaseV1 } from './common.v1.js';

export const CONTROL_COVERAGE_REPORT_V1_REQUIRED_FIELDS = [
  'schemaVersion',
  'controlCode',
  'controlTitle',
  'riskLevel',
  'applicability',
  'requiredCount',
  'satisfiedCount',
  'coveragePercent',
  'approvedEvidenceReferences',
] as const;

export const CONTROL_COVERAGE_CSV_HEADERS_V1 = [
  'schemaVersion',
  'reportType',
  'generatedAt',
  'companyId',
  'companyFrameworkId',
  'frameworkVersionId',
  'controlId',
  'companyControlId',
  'controlCode',
  'controlTitle',
  'riskLevel',
  'applicability',
  'requiredCount',
  'satisfiedCount',
  'coveragePercent',
  'readinessState',
  'approvedEvidenceReferences',
] as const;

export type ApprovedEvidenceReferenceV1 = {
  evidenceItemId: string;
  evidenceVersionId: string;
  requirementId: string | null;
  requirementCode: string | null;
  evidenceTitle: string;
  versionNo: number;
  storageReference: string;
};

export type ControlCoverageReportV1 = VersionedReportBaseV1 & {
  reportType: 'CONTROL_COVERAGE';
  readinessStatus: 'CALCULABLE' | 'NOT_CALCULABLE';
  readinessPercent: number | null;
  controls: Array<{
    controlId: string;
    companyControlId: string;
    controlCode: string;
    controlTitle: string;
    riskLevel: string;
    applicability: 'APPLICABLE';
    requiredCount: number;
    satisfiedCount: number;
    coveragePercent: number;
    readinessState: string;
    approvedEvidenceReferences: ApprovedEvidenceReferenceV1[];
  }>;
};

export function assertControlCoverageReportV1(report: ControlCoverageReportV1): ControlCoverageReportV1 {
  if (report.schemaVersion !== REPORT_SCHEMA_VERSION_V1) throw new Error('CONTROL_COVERAGE report must use schemaVersion v1.');
  if (report.reportType !== 'CONTROL_COVERAGE') throw new Error('Invalid CONTROL_COVERAGE report type.');
  return report;
}
