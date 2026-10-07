import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
function source(path: string) {
  return readFileSync(resolve(backendRoot, path), 'utf8');
}

describe('dashboard readiness contract', () => {
  it('uses canonical readiness and separate operational metrics', () => {
    const service = source('src/modules/dashboard/dashboard.service.ts');
    const repo = source('src/modules/dashboard/dashboard.repository.ts');
    expect(service).toContain('calculateCurrentReadiness');
    expect(service).toContain('readinessStatus: readiness.readinessStatus');
    expect(service).toContain('readinessPercent: readiness.readinessPercent');
    expect(service).toContain('needsReview: evidenceNeedingReview + mappingsNeedingReview');
    expect(service).toContain('overdueTasks');
    expect(service).toContain('expiringWithinDaysCount');
    expect(repo).toContain("status: { notIn: ['COMPLETED', 'CANCELLED'] }");
  });
});
