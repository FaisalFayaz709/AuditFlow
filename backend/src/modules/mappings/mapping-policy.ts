import { AppError } from '../../shared/errors.js';

export type MappingStatusValue = 'SUGGESTED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type EvidenceVersionStatusValue =
  | 'UPLOADED'
  | 'QUARANTINED'
  | 'SECURITY_REJECTED'
  | 'PROCESSING'
  | 'PROCESSING_FAILED'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'ARCHIVED';

export function assertManualMappingCanBeCreated(params: {
  evidenceStatus: EvidenceVersionStatusValue;
  requirementBelongsToControl: boolean;
  controlIsTenantEnrolled: boolean;
}): void {
  if (!params.controlIsTenantEnrolled) {
    throw new AppError({
      statusCode: 404,
      code: 'CONTROL_NOT_FOUND',
      message: 'Control was not found in the active company enrollment.',
    });
  }

  if (!params.requirementBelongsToControl) {
    throw new AppError({
      statusCode: 422,
      code: 'REQUIREMENT_CONTROL_MISMATCH',
      message: 'The evidence requirement must belong to the selected control.',
      details: [{ field: 'requirementId', reason: 'not_under_control' }],
    });
  }

  if (params.evidenceStatus === 'SECURITY_REJECTED' || params.evidenceStatus === 'ARCHIVED') {
    throw new AppError({
      statusCode: 409,
      code: 'EVIDENCE_NOT_MAPPABLE',
      message: 'Security-rejected or archived evidence cannot be mapped.',
      details: [{ field: 'status', reason: params.evidenceStatus }],
    });
  }
}

export function assertMappingCanBeApproved(params: { status: MappingStatusValue; duplicateApprovedExists: boolean }): void {
  if (!['SUGGESTED', 'PENDING_REVIEW'].includes(params.status)) {
    throw new AppError({
      statusCode: 409,
      code: 'INVALID_MAPPING_STATE_TRANSITION',
      message: 'Only suggested or pending mappings can be approved.',
      details: [{ field: 'status', reason: params.status }],
    });
  }

  if (params.duplicateApprovedExists) {
    throw new AppError({
      statusCode: 409,
      code: 'DUPLICATE_APPROVED_MAPPING',
      message: 'An approved mapping already exists for this evidence version and requirement.',
    });
  }
}

export function assertMappingCanBeRejected(status: MappingStatusValue): void {
  if (status === 'REJECTED') {
    throw new AppError({
      statusCode: 409,
      code: 'INVALID_MAPPING_STATE_TRANSITION',
      message: 'Rejected mappings cannot be rejected again.',
      details: [{ field: 'status', reason: status }],
    });
  }
}

export function mappingCanSatisfyRequirement(params: {
  mappingStatus: MappingStatusValue;
  evidenceStatus: EvidenceVersionStatusValue;
  expiryDate?: Date | null;
  effectiveFrom?: Date | null;
  effectiveUntil?: Date | null;
  evidenceItemArchivedAt?: Date | null;
  now: Date;
}): boolean {
  // v2.1 Pass 48 lock: readiness can only be satisfied by an APPROVED
  // mapping plus an APPROVED, current, non-expired, non-archived evidence
  // version. AI confidence and suggested mappings are never readiness inputs.
  if (params.mappingStatus !== 'APPROVED') return false;
  if (params.evidenceStatus !== 'APPROVED') return false;
  if (params.evidenceItemArchivedAt) return false;
  if (params.expiryDate && params.expiryDate.getTime() < params.now.getTime()) return false;
  if (params.effectiveFrom && params.effectiveFrom.getTime() > params.now.getTime()) return false;
  if (params.effectiveUntil && params.effectiveUntil.getTime() < params.now.getTime()) return false;
  return true;
}
