import { describe, expect, it } from 'vitest';
import { GenerateReportBodySchema } from '../src/modules/reports/report.schemas.js';
import { toCsv } from '../src/modules/reports/report-csv.js';

describe('Pass 12 report contracts', () => {
  it('accepts only canonical report types and JSON/CSV formats', () => {
    const parsed = GenerateReportBodySchema.parse({ type: 'AUDIT_READINESS', format: 'CSV' });
    expect(parsed.type).toBe('AUDIT_READINESS');
    expect(parsed.format).toBe('CSV');
    expect(parsed.expiringDays).toBe(30);
    expect(() => GenerateReportBodySchema.parse({ type: 'CERTIFICATION_REPORT', format: 'PDF' })).toThrow();
  });

  it('renders stable CSV output without storage secrets', () => {
    const csv = toCsv([
      { schemaVersion: 'v1', reportType: 'CONTROL_COVERAGE', storageReference: 'evidence_version:ev_1', storage_key: undefined },
    ], ['schemaVersion', 'reportType', 'storageReference']);
    expect(csv).toContain('schemaVersion,reportType,storageReference');
    expect(csv).toContain('v1,CONTROL_COVERAGE,evidence_version:ev_1');
    expect(csv).not.toContain('storage_key');
  });
});
