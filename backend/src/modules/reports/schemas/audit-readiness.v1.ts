import { REPORT_SCHEMA_VERSION_V1, type VersionedReportBaseV1 } from './common.v1.js';

export const AUDIT_READINESS_REPORT_V1_REQUIRED_FIELDS = [
  'schemaVersion',
  'company',
  'framework',
  'generatedAt',
  'targetAuditDate',
  'readinessStatus',
  'readinessPercent',
  'controlCoverage',
  'owners',
  'missingRequirements',
  'expiringEvidence',
  'openTasks',
] as const;

export const AUDIT_READINESS_CSV_HEADERS_V1 = [
  'schemaVersion',
  'reportType',
  'generatedAt',
  'companyId',
  'companyFrameworkId',
  'frameworkVersionId',
  'targetAuditDate',
  'readinessStatus',
  'readinessPercent',
  'controlCode',
  'controlTitle',
  'riskLevel',
  'ownerUserId',
  'requiredCount',
  'satisfiedCount',
  'coveragePercent',
  'readinessState',
  'missingRequirementCount',
  'approvedEvidenceReferenceCount',
  'openTaskCount',
] as const;

export type AuditReadinessReportV1 = VersionedReportBaseV1 & {
  reportType: 'AUDIT_READINESS';
  targetAuditDate: string | null;
  readinessStatus: 'CALCULABLE' | 'NOT_CALCULABLE';
  readinessPercent: number | null;
  controlCoverage: unknown[];
  owners: Array<{ userId: string | null; controlIds: string[]; controlCodes: string[] }>;
  missingRequirements: unknown[];
  expiringEvidence: unknown[];
  openTasks: unknown[];
};

export function assertAuditReadinessReportV1(report: AuditReadinessReportV1): AuditReadinessReportV1 {
  if (report.schemaVersion !== REPORT_SCHEMA_VERSION_V1) throw new Error('AUDIT_READINESS report must use schemaVersion v1.');
  if (report.reportType !== 'AUDIT_READINESS') throw new Error('Invalid AUDIT_READINESS report type.');
  return report;
}
