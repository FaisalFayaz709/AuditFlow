import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateReadiness } from '../src/modules/dashboard/readiness-calculator.js';
import { validateFrameworkVersionForPublication } from '../src/modules/frameworks/frameworks.service.js';
import { AppError } from '../src/shared/errors.js';

const now = new Date('2026-08-08T10:00:00.000Z');
const future = new Date('2026-09-08T10:00:00.000Z');

function validRequirement(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req_1',
    code: 'AC-001-REQ-1',
    required: true,
    sort_order: 1,
    ...overrides,
  };
}

function validControl(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ctrl_1',
    code: 'AC-001',
    control_type: 'EVIDENCE_BASED',
    sort_order: 1,
    evidence_requirements: [validRequirement()],
    ...overrides,
  };
}

describe('Pass 46 frameworks/controls/reconciliation runtime contract', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  const frameworkService = readFileSync(new URL('../src/modules/frameworks/frameworks.service.ts', import.meta.url), 'utf8');
  const upgradeService = readFileSync(new URL('../src/modules/frameworks/framework-upgrade.service.ts', import.meta.url), 'utf8');
  const readiness = readFileSync(new URL('../src/modules/dashboard/readiness-calculator.ts', import.meta.url), 'utf8');

  it('validates evidence-based controls, stable codes, and unique sort ordering before enrollment/upgrade activation', () => {
    expect(() => validateFrameworkVersionForPublication({ controls: [validControl()] })).not.toThrow();
    expect(() =>
      validateFrameworkVersionForPublication({
        controls: [validControl({ evidence_requirements: [validRequirement({ required: false })] })],
      }),
    ).toThrow(AppError);
    expect(() =>
      validateFrameworkVersionForPublication({
        controls: [validControl(), validControl({ id: 'ctrl_2', code: 'AC-001', sort_order: 2 })],
      }),
    ).toThrow(AppError);
    expect(() =>
      validateFrameworkVersionForPublication({
        controls: [validControl({ evidence_requirements: [validRequirement(), validRequirement({ id: 'req_2', code: 'AC-001-REQ-1', sort_order: 2 })] })],
      }),
    ).toThrow(AppError);
  });

  it('allows informational controls to have zero required requirements and excludes them from readiness', () => {
    expect(() =>
      validateFrameworkVersionForPublication({
        controls: [validControl({ id: 'info_1', code: 'INFO-001', control_type: 'INFORMATIONAL', evidence_requirements: [] })],
      }),
    ).not.toThrow();

    const result = calculateReadiness({
      now,
      controls: [
        {
          companyControlId: 'cc_info',
          controlId: 'ctrl_info',
          code: 'INFO-001',
          title: 'Informational note',
          riskLevel: 'LOW',
          controlType: 'INFORMATIONAL',
          applicability: 'APPLICABLE',
          ownerUserId: null,
          requirements: [],
          mappings: [],
        },
      ],
    });

    expect(result.readinessStatus).toBe('NOT_CALCULABLE');
    expect(result.readinessPercent).toBeNull();
    expect(result.eligibleControls).toBe(0);
  });

  it('keeps same-family upgrade reconciliation explicit, transactional, and non-authoritative for mappings', () => {
    expect(upgradeService).toContain('FRAMEWORK_UPGRADE_REQUIRES_SAME_FAMILY');
    expect(upgradeService).toContain("status: 'DRAFT_RECONCILIATION'");
    expect(upgradeService).toContain('proposedApplicabilityAndOwnersRequireReview: true');
    expect(upgradeService).toContain('openTasksRemainOnOldEnrollment: true');
    expect(upgradeService).toContain("status: 'PENDING_REVIEW'");
    expect(upgradeService).toContain('evidenceMappingsApprovedWithoutReview: false');
    expect(upgradeService).toContain("action: 'FRAMEWORK_UPGRADE_STARTED'");
    expect(upgradeService).toContain("action: 'FRAMEWORK_UPGRADED'");
    expect(upgradeService).toContain("status: 'ENDED'");
    expect(upgradeService).toContain("status: 'ACTIVE'");
    expect(upgradeService).toContain('this.prisma.$transaction');
    expect(upgradeService).not.toContain("status: 'APPROVED',\n            reason: candidate.reason");
  });

  it('locks the v2.1 database fields needed for framework enrollment and reconciliation semantics', () => {
    expect(schema).toContain('enum ControlType');
    expect(schema).toContain('EVIDENCE_BASED');
    expect(schema).toContain('INFORMATIONAL');
    expect(schema).toContain('enum CompanyFrameworkStatus');
    expect(schema).toContain('DRAFT_RECONCILIATION');
    expect(schema).toContain('ACTIVE');
    expect(schema).toContain('ENDED');
    expect(schema).toContain('@@index([company_id, framework_id, status])');
    expect(schema).toContain('model FrameworkUpgradeReconciliation');
    expect(schema).toContain('model FrameworkUpgradeControlMatch');
    expect(schema).toContain('model FrameworkUpgradeRequirementMatch');
    expect(schema).toContain('model FrameworkUpgradeMappingCandidate');
  });

  it('keeps readiness restricted to APPLICABLE + EVIDENCE_BASED controls and approved valid mappings', () => {
    expect(readiness).toContain("control.applicability === 'APPLICABLE' && control.controlType === 'EVIDENCE_BASED'");
    expect(readiness).toContain("readinessStatus: 'NOT_CALCULABLE'");
    expect(readiness).toContain('readinessPercent: null');
    expect(readiness).toContain("mapping.status === 'APPROVED'");
    expect(readiness).toContain("evidenceVersion.status !== 'APPROVED'");

    const result = calculateReadiness({
      now,
      controls: [
        {
          companyControlId: 'cc_1',
          controlId: 'ctrl_1',
          code: 'AC-001',
          title: 'Authorized access',
          riskLevel: 'HIGH',
          controlType: 'EVIDENCE_BASED',
          applicability: 'APPLICABLE',
          ownerUserId: null,
          requirements: [{ id: 'req_1', code: 'AC-001-REQ-1', name: 'Current user list', required: true }],
          mappings: [
            {
              id: 'map_1',
              requirementId: 'req_1',
              status: 'APPROVED',
              evidenceVersion: {
                id: 'ev_1',
                status: 'APPROVED',
                expiryDate: future,
                effectiveFrom: null,
                effectiveUntil: null,
                evidenceItemArchivedAt: null,
              },
            },
          ],
        },
      ],
    });

    expect(result.readinessStatus).toBe('CALCULABLE');
    expect(result.readinessPercent).toBe(100);
  });

  it('uses explicit enable/upgrade routes instead of silent framework mutation', () => {
    expect(frameworkService).toContain('ACTIVE_FRAMEWORK_ENROLLMENT_EXISTS');
    expect(frameworkService).toContain('Use upgrade reconciliation instead.');
    expect(frameworkService).toContain("action: 'FRAMEWORK_ENABLED'");
    expect(upgradeService).toContain('FRAMEWORK_UPGRADE_TARGET_ALREADY_ACTIVE');
    expect(upgradeService).toContain('reviewedProposedValues');
  });
});
