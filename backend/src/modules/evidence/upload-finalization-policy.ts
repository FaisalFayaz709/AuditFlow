import { AppError } from '../../shared/errors.js';

export const uploadIntentStates = [
  'CREATED',
  'UPLOADED',
  'VALIDATING',
  'FINALIZING',
  'FINALIZED',
  'FAILED',
  'EXPIRED',
] as const;

export type UploadIntentState = (typeof uploadIntentStates)[number];

const allowedTransitions: Record<UploadIntentState, readonly UploadIntentState[]> = {
  CREATED: ['UPLOADED', 'FAILED', 'EXPIRED'],
  UPLOADED: ['VALIDATING', 'FAILED', 'EXPIRED'],
  VALIDATING: ['FINALIZING', 'FAILED', 'EXPIRED'],
  FINALIZING: ['FINALIZED', 'FAILED'],
  FINALIZED: [],
  FAILED: ['EXPIRED'],
  EXPIRED: [],
};

export function assertUploadIntentTransition(from: UploadIntentState, to: UploadIntentState): void {
  if (!allowedTransitions[from]?.includes(to)) {
    throw new AppError({
      statusCode: 409,
      code: 'UPLOAD_INTENT_INVALID_STATE_TRANSITION',
      message: `Upload intent cannot transition from ${from} to ${to}.`,
    });
  }
}

export function assertUploadChecksum(params: { expectedSha256: string; actualSha256: string }): void {
  if (params.expectedSha256 !== params.actualSha256) {
    throw new AppError({
      statusCode: 422,
      code: 'UPLOAD_CHECKSUM_MISMATCH',
      message: 'Uploaded object checksum does not match the expected checksum; the temporary object must be removed.',
    });
  }
}

export function finalEvidenceStatusAfterObjectFinalization(status: 'QUARANTINED' | 'SECURITY_REJECTED' | 'PROCESSING') {
  return status === 'PROCESSING' ? 'NEEDS_REVIEW' : status;
}

export function uploadFailureCode(error: unknown): string {
  return error instanceof AppError ? error.code : 'UPLOAD_FINALIZATION_FAILED';
}
