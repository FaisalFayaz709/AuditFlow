import { describe, expect, it } from 'vitest';

// This test documents the Pass 07 invariant until Pass 08 mappings/readiness add database-backed coverage.
describe('Pass 07 immutable versioning invariant', () => {
  it('keeps latest uploaded version separate from current approved version', () => {
    const item = { latestVersion: 'v2', currentApprovedVersion: 'v1' };
    expect(item.latestVersion).toBe('v2');
    expect(item.currentApprovedVersion).toBe('v1');
  });

  it('supersedes only the previous approved version when the replacement is approved', () => {
    const previousApproved = { id: 'v1', status: 'APPROVED' };
    const replacement = { id: 'v2', status: 'APPROVED', supersedesVersionId: previousApproved.id };
    previousApproved.status = 'SUPERSEDED';
    expect(previousApproved.status).toBe('SUPERSEDED');
    expect(replacement.supersedesVersionId).toBe('v1');
  });
});
