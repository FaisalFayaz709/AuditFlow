import { REPORT_SCHEMA_VERSION_V1, type VersionedReportBaseV1 } from './common.v1.js';

export const EVIDENCE_INVENTORY_REPORT_V1_REQUIRED_FIELDS = [
  'schemaVersion',
  'evidenceItemId',
  'evidenceVersionId',
  'status',
  'sensitivity',
  'dates',
  'mappings',
  'uploaderUserId',
  'reviewerUserId',
  'checksum',
  'storageReference',
] as const;

export const EVIDENCE_INVENTORY_CSV_HEADERS_V1 = [
  'schemaVersion',
  'reportType',
  'generatedAt',
  'companyId',
  'evidenceItemId',
  'evidenceTitle',
  'evidenceVersionId',
  'versionNo',
  'status',
  'sensitivity',
  'effectiveFrom',
  'effectiveUntil',
  'expiryDate',
  'uploadedAt',
  'reviewedAt',
  'uploaderUserId',
  'reviewerUserId',
  'checksum',
  'storageReference',
  'mappings',
] as const;

export type EvidenceInventoryReportV1 = VersionedReportBaseV1 & {
  reportType: 'EVIDENCE_INVENTORY';
  evidenceInventory: Array<{
    evidenceItemId: string;
    evidenceTitle: string;
    evidenceVersionId: string;
    versionNo: number;
    status: string;
    sensitivity: string;
    dates: {
      effectiveFrom: string | null;
      effectiveUntil: string | null;
      expiryDate: string | null;
      uploadedAt: string;
      reviewedAt: string | null;
    };
    mappings: unknown[];
    uploaderUserId: string;
    reviewerUserId: string | null;
    checksum: string;
    storageReference: string;
  }>;
};

export function assertEvidenceInventoryReportV1(report: EvidenceInventoryReportV1): EvidenceInventoryReportV1 {
  if (report.schemaVersion !== REPORT_SCHEMA_VERSION_V1) throw new Error('EVIDENCE_INVENTORY report must use schemaVersion v1.');
  if (report.reportType !== 'EVIDENCE_INVENTORY') throw new Error('Invalid EVIDENCE_INVENTORY report type.');
  return report;
}
