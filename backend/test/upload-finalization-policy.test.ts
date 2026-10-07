import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import { assertUploadChecksum, assertUploadIntentTransition, finalEvidenceStatusAfterObjectFinalization } from '../src/modules/evidence/upload-finalization-policy.js';

describe('Pass 27 upload finalization policy', () => {
  it('allows only the v2.1 staged upload state progression', () => {
    expect(() => assertUploadIntentTransition('CREATED', 'UPLOADED')).not.toThrow();
    expect(() => assertUploadIntentTransition('UPLOADED', 'VALIDATING')).not.toThrow();
    expect(() => assertUploadIntentTransition('VALIDATING', 'FINALIZING')).not.toThrow();
    expect(() => assertUploadIntentTransition('FINALIZING', 'FINALIZED')).not.toThrow();
    expect(() => assertUploadIntentTransition('FINALIZED', 'FAILED')).toThrow(AppError);
    expect(() => assertUploadIntentTransition('CREATED', 'FINALIZED')).toThrow(AppError);
  });

  it('rejects checksum mismatch before DB evidence finalization', () => {
    expect(() => assertUploadChecksum({ expectedSha256: 'expected', actualSha256: 'actual' })).toThrow(AppError);
    expect(() => assertUploadChecksum({ expectedSha256: 'same', actualSha256: 'same' })).not.toThrow();
  });

  it('does not make evidence reviewable until object finalization resolves processing state', () => {
    expect(finalEvidenceStatusAfterObjectFinalization('PROCESSING')).toBe('NEEDS_REVIEW');
    expect(finalEvidenceStatusAfterObjectFinalization('QUARANTINED')).toBe('QUARANTINED');
    expect(finalEvidenceStatusAfterObjectFinalization('SECURITY_REJECTED')).toBe('SECURITY_REJECTED');
  });
});
