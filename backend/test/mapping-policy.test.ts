import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import { assertManualMappingCanBeCreated, assertMappingCanBeApproved, assertMappingCanBeRejected, mappingCanSatisfyRequirement } from '../src/modules/mappings/mapping-policy.js';

describe('mapping policy', () => {
  it('creates only tenant-enrolled control mappings with matching requirements', () => {
    expect(() =>
      assertManualMappingCanBeCreated({
        evidenceStatus: 'NEEDS_REVIEW',
        controlIsTenantEnrolled: true,
        requirementBelongsToControl: true,
      }),
    ).not.toThrow();

    expect(() =>
      assertManualMappingCanBeCreated({
        evidenceStatus: 'NEEDS_REVIEW',
        controlIsTenantEnrolled: false,
        requirementBelongsToControl: true,
      }),
    ).toThrow(AppError);

    expect(() =>
      assertManualMappingCanBeCreated({
        evidenceStatus: 'NEEDS_REVIEW',
        controlIsTenantEnrolled: true,
        requirementBelongsToControl: false,
      }),
    ).toThrow(AppError);
  });

  it('blocks mapping security-rejected or archived evidence', () => {
    expect(() =>
      assertManualMappingCanBeCreated({
        evidenceStatus: 'SECURITY_REJECTED',
        controlIsTenantEnrolled: true,
        requirementBelongsToControl: true,
      }),
    ).toThrow(AppError);

    expect(() =>
      assertManualMappingCanBeCreated({
        evidenceStatus: 'ARCHIVED',
        controlIsTenantEnrolled: true,
        requirementBelongsToControl: true,
      }),
    ).toThrow(AppError);
  });

  it('approves only suggested or pending mappings and blocks duplicate approved pairs', () => {
    expect(() => assertMappingCanBeApproved({ status: 'PENDING_REVIEW', duplicateApprovedExists: false })).not.toThrow();
    expect(() => assertMappingCanBeApproved({ status: 'SUGGESTED', duplicateApprovedExists: false })).not.toThrow();
    expect(() => assertMappingCanBeApproved({ status: 'APPROVED', duplicateApprovedExists: false })).toThrow(AppError);
    expect(() => assertMappingCanBeApproved({ status: 'PENDING_REVIEW', duplicateApprovedExists: true })).toThrow(AppError);
  });

  it('prevents repeated rejection of an already rejected mapping', () => {
    expect(() => assertMappingCanBeRejected('PENDING_REVIEW')).not.toThrow();
    expect(() => assertMappingCanBeRejected('APPROVED')).not.toThrow();
    expect(() => assertMappingCanBeRejected('REJECTED')).toThrow(AppError);
  });

  it('models the future readiness invariant without letting pending mappings count', () => {
    const now = new Date('2026-08-08T10:00:00Z');
    expect(mappingCanSatisfyRequirement({ mappingStatus: 'APPROVED', evidenceStatus: 'APPROVED', expiryDate: null, now })).toBe(true);
    expect(mappingCanSatisfyRequirement({ mappingStatus: 'PENDING_REVIEW', evidenceStatus: 'APPROVED', expiryDate: null, now })).toBe(false);
    expect(mappingCanSatisfyRequirement({ mappingStatus: 'APPROVED', evidenceStatus: 'REJECTED', expiryDate: null, now })).toBe(false);
    expect(mappingCanSatisfyRequirement({ mappingStatus: 'APPROVED', evidenceStatus: 'APPROVED', expiryDate: new Date('2026-08-07T00:00:00Z'), now })).toBe(false);
  });
});
