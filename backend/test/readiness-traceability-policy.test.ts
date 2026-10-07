import { describe, expect, it } from 'vitest';
import { calculateReadiness, type ReadinessControlInput } from '../src/modules/dashboard/readiness-calculator.js';
import { buildReadinessTrace } from '../src/modules/dashboard/readiness-trace.js';

const now = new Date('2026-08-08T12:00:00.000Z');

function baseControl(overrides: Partial<ReadinessControlInput> = {}): ReadinessControlInput {
  return {
    companyControlId: 'cc-1',
    controlId: 'c-1',
    code: 'AC-001',
    title: 'Authorized access',
    riskLevel: 'HIGH',
    controlType: 'EVIDENCE_BASED',
    applicability: 'APPLICABLE',
    ownerUserId: 'user-owner',
    requirements: [
      { id: 'req-1', code: 'ACCESS_LIST', name: 'Current user/access list', required: true },
      { id: 'req-optional', code: 'SCREENSHOT', name: 'Supporting screenshot', required: false },
    ],
    mappings: [],
    ...overrides,
  };
}

function approvedMapping(params: { id: string; requirementId: string; evidenceVersionId: string; status?: 'APPROVED' | 'SUGGESTED' | 'PENDING_REVIEW' | 'REJECTED'; evidenceStatus?: 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'SUPERSEDED' | 'ARCHIVED'; expiryDate?: Date | null }) {
  return {
    id: params.id,
    requirementId: params.requirementId,
    status: params.status ?? 'APPROVED',
    evidenceVersion: {
      id: params.evidenceVersionId,
      status: params.evidenceStatus ?? 'APPROVED',
      expiryDate: params.expiryDate ?? null,
      effectiveFrom: null,
      effectiveUntil: null,
      evidenceItemArchivedAt: null,
    },
  };
}

describe('Pass 32 readiness traceability', () => {
  it('returns NOT_CALCULABLE/null when there are no applicable evidence-based controls', () => {
    const controls = [baseControl({ controlType: 'INFORMATIONAL' })];
    const readiness = calculateReadiness({ controls, now });
    const trace = buildReadinessTrace({ controls, readinessStatus: readiness.readinessStatus, readinessPercent: readiness.readinessPercent, calculatedAt: now });

    expect(trace.readinessStatus).toBe('NOT_CALCULABLE');
    expect(trace.readinessPercent).toBeNull();
    expect(trace.denominator).toBe(0);
    expect(trace.controls[0]?.eligibleForReadiness).toBe(false);
    expect(trace.controls[0]?.exclusionReason).toBe('INFORMATIONAL');
  });

  it('traces approved mappings and current approved evidence versions that satisfy a requirement', () => {
    const controls = [baseControl({ mappings: [approvedMapping({ id: 'map-1', requirementId: 'req-1', evidenceVersionId: 'ev-1' })] })];
    const readiness = calculateReadiness({ controls, now });
    const trace = buildReadinessTrace({ controls, readinessStatus: readiness.readinessStatus, readinessPercent: readiness.readinessPercent, calculatedAt: now });
    const required = trace.controls[0]?.requirements.find((requirement) => requirement.requirementId === 'req-1');

    expect(trace.readinessPercent).toBe(100);
    expect(required?.satisfied).toBe(true);
    expect(required?.approvedMappingIds).toEqual(['map-1']);
    expect(required?.satisfyingEvidenceVersionIds).toEqual(['ev-1']);
    expect(required?.mappingEvaluations[0]?.countsTowardReadiness).toBe(true);
    expect(required?.mappingEvaluations[0]?.validityReasons).toContain('SATISFIES_REQUIREMENT');
    expect(trace.traceScope.aiConfidenceUsed).toBe(false);
  });

  it('shows suggested mappings, rejected evidence, expired evidence, and optional gaps without counting them', () => {
    const controls = [
      baseControl({
        mappings: [
          approvedMapping({ id: 'map-suggested', requirementId: 'req-1', evidenceVersionId: 'ev-suggested', status: 'SUGGESTED' }),
          approvedMapping({ id: 'map-rejected-evidence', requirementId: 'req-1', evidenceVersionId: 'ev-rejected', evidenceStatus: 'REJECTED' }),
          approvedMapping({ id: 'map-expired', requirementId: 'req-1', evidenceVersionId: 'ev-expired', expiryDate: new Date('2026-01-01T00:00:00.000Z') }),
        ],
      }),
    ];
    const readiness = calculateReadiness({ controls, now });
    const trace = buildReadinessTrace({ controls, readinessStatus: readiness.readinessStatus, readinessPercent: readiness.readinessPercent, calculatedAt: now });
    const required = trace.controls[0]?.requirements.find((requirement) => requirement.requirementId === 'req-1');
    const optional = trace.controls[0]?.requirements.find((requirement) => requirement.requirementId === 'req-optional');

    expect(trace.readinessPercent).toBe(0);
    expect(required?.satisfied).toBe(false);
    expect(required?.mappingEvaluations.map((evaluation) => evaluation.countsTowardReadiness)).toEqual([false, false, false]);
    expect(required?.mappingEvaluations.flatMap((evaluation) => evaluation.validityReasons)).toEqual(expect.arrayContaining(['MAPPING_NOT_APPROVED', 'EVIDENCE_NOT_APPROVED', 'EVIDENCE_EXPIRED']));
    expect(optional?.required).toBe(false);
    expect(optional?.advisoryGap).toBe(true);
  });

  it('counts multiple valid files for one requirement once while retaining trace evidence IDs', () => {
    const controls = [
      baseControl({
        mappings: [
          approvedMapping({ id: 'map-1', requirementId: 'req-1', evidenceVersionId: 'ev-1' }),
          approvedMapping({ id: 'map-2', requirementId: 'req-1', evidenceVersionId: 'ev-2' }),
        ],
      }),
    ];
    const readiness = calculateReadiness({ controls, now });
    const trace = buildReadinessTrace({ controls, readinessStatus: readiness.readinessStatus, readinessPercent: readiness.readinessPercent, calculatedAt: now });
    const control = trace.controls[0];
    const required = control?.requirements.find((requirement) => requirement.requirementId === 'req-1');

    expect(control?.requiredCount).toBe(1);
    expect(control?.satisfiedCount).toBe(1);
    expect(required?.satisfyingEvidenceVersionIds).toEqual(['ev-1', 'ev-2']);
  });
});
