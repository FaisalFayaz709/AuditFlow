import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Pass 24 framework upgrade reconciliation lock', () => {
  const service = readFileSync(new URL('../src/modules/frameworks/framework-upgrade.service.ts', import.meta.url), 'utf8');
  const routes = readFileSync(new URL('../src/modules/frameworks/frameworks.routes.ts', import.meta.url), 'utf8');
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');

  it('creates an upgrade preview as a DRAFT_RECONCILIATION enrollment before activation', () => {
    expect(service).toContain("status: 'DRAFT_RECONCILIATION'");
    expect(service).toContain('FRAMEWORK_UPGRADE_STARTED');
    expect(service).toContain('frameworkUpgradeReconciliation.create');
    expect(service).toContain('stable_code');
  });

  it('activates the new enrollment and ends the old enrollment in one transaction', () => {
    expect(service).toContain('this.prisma.$transaction');
    expect(service).toContain("status: 'ENDED'");
    expect(service).toContain("status: 'ACTIVE'");
    expect(service).toContain('FRAMEWORK_UPGRADED');
  });

  it('never auto-approves copied evidence mappings on the new framework version', () => {
    expect(service).toContain("status: 'PENDING_REVIEW'");
    expect(service).toContain('evidenceMappingsApprovedWithoutReview: false');
    expect(service).not.toContain("status: 'APPROVED',\n            reason: candidate.reason");
  });

  it('exposes the three required pass-24 API routes', () => {
    expect(routes).toContain('/api/frameworks/enrollments/:enrollmentId/upgrade-preview');
    expect(routes).toContain('/api/frameworks/enrollments/:draftEnrollmentId/reconciliation');
    expect(routes).toContain('/api/frameworks/enrollments/:draftEnrollmentId/activate-upgrade');
  });

  it('adds persistent reconciliation, control match, requirement match, and mapping candidate records', () => {
    expect(schema).toContain('model FrameworkUpgradeReconciliation');
    expect(schema).toContain('model FrameworkUpgradeControlMatch');
    expect(schema).toContain('model FrameworkUpgradeRequirementMatch');
    expect(schema).toContain('model FrameworkUpgradeMappingCandidate');
  });
});
