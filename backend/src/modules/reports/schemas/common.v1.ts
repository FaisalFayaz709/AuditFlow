export const REPORT_SCHEMA_VERSION_V1 = 'v1' as const;

export const REPORT_LANGUAGE_BOUNDARY_V1 =
  'AuditFlow reports readiness and evidence coverage only; not certification or legal compliance.';

export type ReportCompanyV1 = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
};

export type ReportFrameworkV1 = {
  companyFrameworkId: string;
  frameworkId: string;
  frameworkName: string;
  frameworkVersionId: string;
  frameworkVersion: string;
  targetAuditDate: string | null;
} | null;

export type VersionedReportBaseV1 = {
  schemaVersion: typeof REPORT_SCHEMA_VERSION_V1;
  reportType: 'AUDIT_READINESS' | 'MISSING_EVIDENCE' | 'CONTROL_COVERAGE' | 'EVIDENCE_INVENTORY';
  generatedAt: string;
  calculatedAt: string;
  languageBoundary: typeof REPORT_LANGUAGE_BOUNDARY_V1;
  company: ReportCompanyV1;
  framework: ReportFrameworkV1;
  parameters: {
    companyFrameworkId: string | null;
    expiringDays: number;
  };
};

export function baseReportFieldsV1<TType extends VersionedReportBaseV1['reportType']>(params: {
  reportType: TType;
  generatedAt: string;
  calculatedAt: string;
  company: ReportCompanyV1;
  framework: ReportFrameworkV1;
  parameters: VersionedReportBaseV1['parameters'];
}): VersionedReportBaseV1 & { reportType: TType } {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION_V1,
    reportType: params.reportType,
    generatedAt: params.generatedAt,
    calculatedAt: params.calculatedAt,
    languageBoundary: REPORT_LANGUAGE_BOUNDARY_V1,
    company: params.company,
    framework: params.framework,
    parameters: params.parameters,
  };
}
