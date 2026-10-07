import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';
import { AppError } from '../src/shared/errors.js';
import { assertEvidenceCanBeApproved, assertEvidenceCanBeRejected, assertValidityRange } from '../src/modules/evidence/evidence-review-policy.js';
import { mappingCanSatisfyRequirement } from '../src/modules/mappings/mapping-policy.js';
import { calculateReadiness, type ReadinessControlInput } from '../src/modules/dashboard/readiness-calculator.js';
import { buildReadinessTrace } from '../src/modules/dashboard/readiness-trace.js';

const now = new Date('2026-08-08T10:00:00.000Z');
const past = new Date('2026-08-07T10:00:00.000Z');
const future = new Date('2026-08-09T10:00:00.000Z');
const approvalTime = new Date('2026-08-08T09:00:00.000Z');

const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/auditflow_test',
  SESSION_PEPPER: 'test_session_pepper_with_minimum_32_chars',
  SECURITY_SCAN_MODE: 'required',
});

function evidence(id: string, overrides: Partial<ReadinessControlInput['mappings'][number]['evidenceVersion']> = {}) {
  return {
    id,
    status: 'APPROVED' as const,
    expiryDate: null,
    effectiveFrom: null,
    effectiveUntil: null,
    evidenceItemArchivedAt: null,
    approval: { reviewId: `review-${id}`, reviewerUserId: 'reviewer-user', reviewedAt: approvalTime },
    ...overrides,
  };
}

function mapping(
  id: string,
  requirementId: string,
  overrides: Partial<ReadinessControlInput['mappings'][number]> = {},
): ReadinessControlInput['mappings'][number] {
  return {
    id,
    requirementId,
    status: 'APPROVED',
    source: 'MANUAL',
    traceMetadata: { storedConfidence: null },
    mappedByUserId: 'mapper-user',
    mappingReview: { reviewedByUserId: 'mapping-reviewer', reviewedAt: approvalTime },
    evidenceVersion: evidence(`ev-${id}`),
    ...overrides,
  };
}

function control(overrides: Partial<ReadinessControlInput> = {}): ReadinessControlInput {
  return {
    companyControlId: 'company-control-1',
    controlId: 'control-1',
    code: 'AC-001',
    title: 'Authorized access',
    riskLevel: 'HIGH',
    controlType: 'EVIDENCE_BASED',
    applicability: 'APPLICABLE',
    ownerUserId: 'owner-user',
    requirements: [
      { id: 'req-1', code: 'AC-001-REQ-1', name: 'Current user/access list', required: true },
      { id: 'req-2', code: 'AC-001-REQ-2', name: 'Access approval record', required: true },
      { id: 'req-optional', code: 'AC-001-REQ-O', name: 'Supporting screenshot', required: false },
    ],
    mappings: [],
    ...overrides,
  };
}

describe('Pass 48 evidence review, mapping review, and readiness traceability runtime gate', () => {
  it('approves evidence only from NEEDS_REVIEW after clean security clearance or explicit non-production bypass', () => {
    expect(() => assertEvidenceCanBeApproved({ state: { status: 'NEEDS_REVIEW', securityScanStatus: 'CLEAN' }, env })).not.toThrow();
    expect(() => assertEvidenceCanBeApproved({ state: { status: 'PROCESSING', securityScanStatus: 'CLEAN' }, env })).toThrow(AppError);
    expect(() => assertEvidenceCanBeApproved({ state: { status: 'NEEDS_REVIEW', securityScanStatus: 'PENDING' }, env })).toThrow(AppError);
    expect(() => assertEvidenceCanBeApproved({ state: { status: 'NEEDS_REVIEW', securityScanStatus: 'MALICIOUS' }, env })).toThrow(AppError);
    expect(() => assertEvidenceCanBeRejected({ status: 'NEEDS_REVIEW' })).not.toThrow();
    expect(() => assertEvidenceCanBeRejected({ status: 'APPROVED' })).toThrow(AppError);
    expect(() => assertValidityRange({ effectiveFrom: future, expiryDate: past })).toThrow(AppError);
  });

  it('keeps mapping satisfaction aligned with canonical readiness validity rules', () => {
    expect(mappingCanSatisfyRequirement({ mappingStatus: 'APPROVED', evidenceStatus: 'APPROVED', now })).toBe(true);
    expect(mappingCanSatisfyRequirement({ mappingStatus: 'SUGGESTED', evidenceStatus: 'APPROVED', now })).toBe(false);
    expect(mappingCanSatisfyRequirement({ mappingStatus: 'APPROVED', evidenceStatus: 'REJECTED', now })).toBe(false);
    expect(mappingCanSatisfyRequirement({ mappingStatus: 'APPROVED', evidenceStatus: 'APPROVED', expiryDate: past, now })).toBe(false);
    expect(mappingCanSatisfyRequirement({ mappingStatus: 'APPROVED', evidenceStatus: 'APPROVED', effectiveFrom: future, now })).toBe(false);
    expect(mappingCanSatisfyRequirement({ mappingStatus: 'APPROVED', evidenceStatus: 'APPROVED', effectiveUntil: past, now })).toBe(false);
    expect(mappingCanSatisfyRequirement({ mappingStatus: 'APPROVED', evidenceStatus: 'APPROVED', evidenceItemArchivedAt: now, now })).toBe(false);
  });

  it('does not let AI suggestions, rejected evidence, expired evidence, or optional proof alter readiness', () => {
    const result = calculateReadiness({
      now,
      controls: [
        control({
          mappings: [
            mapping('approved-1', 'req-1'),
            mapping('ai-suggested', 'req-2', { source: 'AI_SUGGESTED', traceMetadata: { storedConfidence: 0.99 }, status: 'SUGGESTED' }),
            mapping('rejected-evidence', 'req-2', { evidenceVersion: evidence('ev-rejected', { status: 'REJECTED' }) }),
            mapping('expired-evidence', 'req-2', { evidenceVersion: evidence('ev-expired', { expiryDate: past }) }),
            mapping('optional-proof', 'req-optional'),
          ],
        }),
      ],
    });

    expect(result.readinessStatus).toBe('CALCULABLE');
    expect(result.readinessPercent).toBe(50);
    expect(result.missingRequiredEvidence).toBe(1);
    expect(result.controlCoverage[0]?.requirements.map((requirement) => requirement.id)).toEqual(['req-1', 'req-2']);
  });

  it('returns a readiness trace with evidence review, mapping review, validity, and audit-event hints', () => {
    const controls = [control({ mappings: [mapping('approved-1', 'req-1')] })];
    const readiness = calculateReadiness({ controls, now });
    const trace = buildReadinessTrace({
      controls,
      readinessStatus: readiness.readinessStatus,
      readinessPercent: readiness.readinessPercent,
      calculatedAt: now,
    });

    const required = trace.controls[0]?.requirements.find((requirement) => requirement.requirementId === 'req-1');
    const evaluation = required?.mappingEvaluations[0];

    expect(trace.traceScope.eligibleRule).toBe('APPLICABLE_EVIDENCE_BASED_CONTROLS_ONLY');
    expect(trace.traceScope.evidenceRule).toBe('APPROVED_VALID_EVIDENCE_WITH_APPROVED_MAPPING');
    expect(trace.traceScope.aiConfidenceUsed).toBe(false);
    expect(trace.traceScope.auditEventRule).toBe('EVIDENCE_APPROVED_AND_MAPPING_APPROVED_EVENTS_LINK_BUSINESS_STATE');
    expect(trace.traceScope.traceIncludes).toEqual(
      expect.arrayContaining(['enrollment', 'control', 'requirement', 'evidence_version', 'evidence_review', 'mapping_review', 'validity', 'audit_event_hints']),
    );
    expect(required?.satisfied).toBe(true);
    expect(evaluation?.countsTowardReadiness).toBe(true);
    expect(evaluation?.aiConfidenceUsed).toBe(false);
    expect(evaluation?.evidenceReviewId).toBe('review-ev-approved-1');
    expect(evaluation?.evidenceApprovedByUserId).toBe('reviewer-user');
    expect(evaluation?.mappingReviewedByUserId).toBe('mapping-reviewer');
    expect(evaluation?.auditEventHints).toEqual(['EVIDENCE_APPROVED', 'MAPPING_APPROVED']);
    expect(evaluation?.validityReasons).toContain('SATISFIES_REQUIREMENT');
  });
});
