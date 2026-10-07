import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REPORT_LANGUAGE_BOUNDARY_V1, REPORT_SCHEMA_VERSION_V1 } from '../src/modules/reports/schemas/index.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
function source(path: string) {
  return readFileSync(resolve(backendRoot, path), 'utf8');
}

describe('report generation contract', () => {
  it('uses versioned readiness/evidence coverage reports without certification claims', () => {
    expect(REPORT_SCHEMA_VERSION_V1).toBe('v1');
    expect(REPORT_LANGUAGE_BOUNDARY_V1).toContain('readiness and evidence coverage only');
    expect(REPORT_LANGUAGE_BOUNDARY_V1).toContain('not certification or legal compliance');
    const reportsService = source('src/modules/reports/reports.service.ts');
    expect(reportsService).toContain('schema_version: SCHEMA_VERSION');
    expect(reportsService).toContain('parameters_json');
    expect(reportsService).toContain('framework_enrollment_id');
    expect(reportsService).toContain('framework_version_id');
    expect(reportsService).toContain('calculated_at: now');
    expect(reportsService).toContain("action: 'REPORT_GENERATED'");
    expect(reportsService).toContain("action: 'REPORT_DOWNLOADED'");
  });
});
