import { describe, expect, it } from 'vitest';
import { toCsv } from '../src/modules/reports/report-csv.js';
import {
  AUDIT_READINESS_CSV_HEADERS_V1,
  AUDIT_READINESS_REPORT_V1_REQUIRED_FIELDS,
  CONTROL_COVERAGE_CSV_HEADERS_V1,
  CONTROL_COVERAGE_REPORT_V1_REQUIRED_FIELDS,
  EVIDENCE_INVENTORY_CSV_HEADERS_V1,
  EVIDENCE_INVENTORY_REPORT_V1_REQUIRED_FIELDS,
  MISSING_EVIDENCE_CSV_HEADERS_V1,
  MISSING_EVIDENCE_REPORT_V1_REQUIRED_FIELDS,
  REPORT_LANGUAGE_BOUNDARY_V1,
  REPORT_SCHEMA_VERSION_V1,
} from '../src/modules/reports/schemas/index.js';

describe('Pass 31 versioned report schemas', () => {
  it('locks the four canonical report schema versions and required fields', () => {
    expect(REPORT_SCHEMA_VERSION_V1).toBe('v1');
    expect(AUDIT_READINESS_REPORT_V1_REQUIRED_FIELDS).toEqual(expect.arrayContaining([
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
    ]));
    expect(MISSING_EVIDENCE_REPORT_V1_REQUIRED_FIELDS).toEqual(expect.arrayContaining(['controlCode', 'requirementCode', 'riskLevel', 'ownerUserId', 'satisfactionStatus', 'taskStatus', 'taskDueDate']));
    expect(CONTROL_COVERAGE_REPORT_V1_REQUIRED_FIELDS).toEqual(expect.arrayContaining(['controlCode', 'controlTitle', 'riskLevel', 'applicability', 'requiredCount', 'satisfiedCount', 'coveragePercent', 'approvedEvidenceReferences']));
    expect(EVIDENCE_INVENTORY_REPORT_V1_REQUIRED_FIELDS).toEqual(expect.arrayContaining(['evidenceItemId', 'evidenceVersionId', 'status', 'sensitivity', 'dates', 'mappings', 'uploaderUserId', 'reviewerUserId', 'checksum', 'storageReference']));
  });

  it('locks stable CSV headers for every v1 report', () => {
    expect(AUDIT_READINESS_CSV_HEADERS_V1).toContain('openTaskCount');
    expect(MISSING_EVIDENCE_CSV_HEADERS_V1).toEqual(expect.arrayContaining(['taskStatus', 'taskDueDate']));
    expect(CONTROL_COVERAGE_CSV_HEADERS_V1).toContain('approvedEvidenceReferences');
    expect(EVIDENCE_INVENTORY_CSV_HEADERS_V1).toEqual(expect.arrayContaining(['checksum', 'storageReference', 'mappings']));

    const csv = toCsv(
      [{ schemaVersion: 'v1', reportType: 'MISSING_EVIDENCE', taskStatus: 'TODO', taskDueDate: '2026-08-31' }],
      [...MISSING_EVIDENCE_CSV_HEADERS_V1],
    );
    expect(csv.split('\n')[0]).toContain('taskStatus,taskDueDate');
  });

  it('uses readiness/evidence language and blocks certification wording', () => {
    expect(REPORT_LANGUAGE_BOUNDARY_V1).toContain('readiness and evidence coverage');
    expect(REPORT_LANGUAGE_BOUNDARY_V1).not.toMatch(/certified compliant|SOC 2 certified by AuditFlow/i);
  });
});
