import type { AppEnv } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';

export type ReviewableEvidenceState = {
  status: string;
  securityScanStatus: string;
  effectiveFrom?: Date | null;
  effectiveUntil?: Date | null;
  expiryDate?: Date | null;
};

export function assertEvidenceCanBeApproved(params: { state: ReviewableEvidenceState; env: AppEnv }): void {
  if (params.state.status !== 'NEEDS_REVIEW') {
    throw new AppError({
      statusCode: 409,
      code: 'INVALID_STATE_TRANSITION',
      message: 'Only evidence versions in NEEDS_REVIEW can be approved.',
      details: [{ field: 'status', reason: `current=${params.state.status}` }],
    });
  }

  const scanIsClean = params.state.securityScanStatus === 'CLEAN';
  const nonProductionBypass =
    params.env.NODE_ENV !== 'production' &&
    params.env.SECURITY_SCAN_MODE === 'disabled_non_production' &&
    params.state.securityScanStatus === 'NOT_REQUIRED';

  if (!scanIsClean && !nonProductionBypass) {
    throw new AppError({
      statusCode: 409,
      code: 'EVIDENCE_SECURITY_NOT_CLEARED',
      message: 'Evidence cannot be approved until malware/security validation is clean or explicitly bypassed in non-production.',
      details: [{ field: 'securityScanStatus', reason: `current=${params.state.securityScanStatus}` }],
    });
  }
}

export function assertEvidenceCanBeRejected(state: { status: string }): void {
  if (state.status !== 'NEEDS_REVIEW') {
    throw new AppError({
      statusCode: 409,
      code: 'INVALID_STATE_TRANSITION',
      message: 'Only evidence versions in NEEDS_REVIEW can be rejected.',
      details: [{ field: 'status', reason: `current=${state.status}` }],
    });
  }
}

export function assertValidityRange(params: {
  effectiveFrom?: Date | null;
  effectiveUntil?: Date | null;
  expiryDate?: Date | null;
}): void {
  if (params.effectiveFrom && params.effectiveUntil && params.effectiveUntil < params.effectiveFrom) {
    throw new AppError({
      statusCode: 422,
      code: 'INVALID_VALIDITY_RANGE',
      message: 'effectiveUntil must be greater than or equal to effectiveFrom.',
      details: [{ field: 'effectiveUntil', reason: 'must be >= effectiveFrom' }],
    });
  }

  if (params.effectiveFrom && params.expiryDate && params.expiryDate < params.effectiveFrom) {
    throw new AppError({
      statusCode: 422,
      code: 'INVALID_VALIDITY_RANGE',
      message: 'expiryDate must be greater than or equal to effectiveFrom.',
      details: [{ field: 'expiryDate', reason: 'must be >= effectiveFrom' }],
    });
  }
}
