import { describe, expect, it } from 'vitest';
import { calculateReadiness, isEvidenceVersionCurrentlyValid, type ReadinessControlInput } from '../src/modules/dashboard/readiness-calculator.js';

const now = new Date('2026-08-08T10:00:00.000Z');
const future = new Date('2026-09-08T10:00:00.000Z');
const past = new Date('2026-07-08T10:00:00.000Z');

function approvedEvidence(id: string, overrides: Partial<ReadinessControlInput['mappings'][number]['evidenceVersion']> = {}) {
  return {
    id,
    status: 'APPROVED' as const,
    expiryDate: future,
    effectiveFrom: null,
    effectiveUntil: null,
    evidenceItemArchivedAt: null,
    ...overrides,
  };
}

function baseControl(overrides: Partial<ReadinessControlInput> = {}): ReadinessControlInput {
  return {
    companyControlId: 'cc_1',
    controlId: 'ctrl_1',
    code: 'AC-001',
    title: 'Authorized access',
    riskLevel: 'HIGH',
    controlType: 'EVIDENCE_BASED',
    applicability: 'APPLICABLE',
    ownerUserId: 'user_1',
    requirements: [
      { id: 'req_1', code: 'AC-001-REQ-1', name: 'Current user list', required: true },
      { id: 'req_2', code: 'AC-001-REQ-2', name: 'Approval record', required: true },
      { id: 'req_optional', code: 'AC-001-REQ-O', name: 'Supporting screenshot', required: false },
    ],
    mappings: [],
    ...overrides,
  };
}

describe('canonical readiness calculator', () => {
  it('returns NOT_CALCULABLE when there are no applicable evidence-based controls', () => {
    const result = calculateReadiness({
      now,
      controls: [
        baseControl({ controlType: 'INFORMATIONAL' }),
        baseControl({ companyControlId: 'cc_2', controlId: 'ctrl_2', applicability: 'NOT_APPLICABLE' }),
      ],
    });

    expect(result.readinessStatus).toBe('NOT_CALCULABLE');
    expect(result.readinessPercent).toBeNull();
    expect(result.eligibleControls).toBe(0);
  });

  it('excludes informational and not-applicable controls from the numerator and denominator', () => {
    const result = calculateReadiness({
      now,
      controls: [
        baseControl({
          mappings: [
            { id: 'map_1', requirementId: 'req_1', status: 'APPROVED', evidenceVersion: approvedEvidence('ev_1') },
            { id: 'map_2', requirementId: 'req_2', status: 'APPROVED', evidenceVersion: approvedEvidence('ev_2') },
          ],
        }),
        baseControl({ companyControlId: 'cc_info', controlId: 'ctrl_info', controlType: 'INFORMATIONAL', mappings: [] }),
        baseControl({ companyControlId: 'cc_na', controlId: 'ctrl_na', applicability: 'NOT_APPLICABLE', mappings: [] }),
      ],
    });

    expect(result.readinessStatus).toBe('CALCULABLE');
    expect(result.readinessPercent).toBe(100);
    expect(result.eligibleControls).toBe(1);
  });

  it('calculates the required evidence requirement coverage with risk weighting', () => {
    const highHalfCovered = baseControl({
      companyControlId: 'cc_high',
      controlId: 'ctrl_high',
      riskLevel: 'HIGH',
      mappings: [{ id: 'map_1', requirementId: 'req_1', status: 'APPROVED', evidenceVersion: approvedEvidence('ev_1') }],
    });
    const lowFullyCovered = baseControl({
      companyControlId: 'cc_low',
      controlId: 'ctrl_low',
      riskLevel: 'LOW',
      mappings: [
        { id: 'map_2', requirementId: 'req_1', status: 'APPROVED', evidenceVersion: approvedEvidence('ev_2') },
        { id: 'map_3', requirementId: 'req_2', status: 'APPROVED', evidenceVersion: approvedEvidence('ev_3') },
      ],
    });

    const result = calculateReadiness({ now, controls: [highHalfCovered, lowFullyCovered] });

    // 100 * ((0.5 * HIGH:3) + (1.0 * LOW:1)) / (3 + 1) = 62.5
    expect(result.readinessPercent).toBe(62.5);
    expect(result.readyControls).toBe(1);
    expect(result.inProgressControls).toBe(1);
    expect(result.missingRequiredEvidence).toBe(1);
  });

  it('does not count suggested mappings, rejected evidence, expired evidence, or optional requirements', () => {
    const result = calculateReadiness({
      now,
      controls: [
        baseControl({
          mappings: [
            { id: 'suggested', requirementId: 'req_1', status: 'SUGGESTED', evidenceVersion: approvedEvidence('ev_suggested') },
            { id: 'rejected_ev', requirementId: 'req_1', status: 'APPROVED', evidenceVersion: approvedEvidence('ev_rejected', { status: 'REJECTED' }) },
            { id: 'expired_ev', requirementId: 'req_1', status: 'APPROVED', evidenceVersion: approvedEvidence('ev_expired', { expiryDate: past }) },
            { id: 'optional', requirementId: 'req_optional', status: 'APPROVED', evidenceVersion: approvedEvidence('ev_optional') },
          ],
        }),
      ],
    });

    expect(result.readinessPercent).toBe(0);
    expect(result.missingRequiredEvidence).toBe(2);
    expect(result.controlCoverage[0]?.requirements).toHaveLength(2);
  });

  it('counts multiple valid files for one requirement only once', () => {
    const result = calculateReadiness({
      now,
      controls: [
        baseControl({
          mappings: [
            { id: 'map_1', requirementId: 'req_1', status: 'APPROVED', evidenceVersion: approvedEvidence('ev_1') },
            { id: 'map_2', requirementId: 'req_1', status: 'APPROVED', evidenceVersion: approvedEvidence('ev_2') },
          ],
        }),
      ],
    });

    expect(result.controlCoverage[0]?.satisfiedCount).toBe(1);
    expect(result.readinessPercent).toBe(50);
  });

  it('treats future-effective or archived evidence as invalid for current readiness', () => {
    expect(isEvidenceVersionCurrentlyValid(approvedEvidence('future', { effectiveFrom: future }), now)).toBe(false);
    expect(isEvidenceVersionCurrentlyValid(approvedEvidence('archived', { evidenceItemArchivedAt: now }), now)).toBe(false);
    expect(isEvidenceVersionCurrentlyValid(approvedEvidence('valid'), now)).toBe(true);
  });
});
