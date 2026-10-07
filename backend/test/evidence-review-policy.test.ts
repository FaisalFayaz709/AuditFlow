import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';
import { AppError } from '../src/shared/errors.js';
import { assertEvidenceCanBeApproved, assertEvidenceCanBeRejected, assertValidityRange } from '../src/modules/evidence/evidence-review-policy.js';

const baseEnv = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/auditflow_test',
  SESSION_PEPPER: 'test_session_pepper_with_minimum_32_chars',
});

describe('evidence review policy', () => {
  it('allows approval from NEEDS_REVIEW with explicit non-production scan bypass', () => {
    expect(() => assertEvidenceCanBeApproved({ state: { status: 'NEEDS_REVIEW', securityScanStatus: 'NOT_REQUIRED' }, env: baseEnv })).not.toThrow();
  });

  it('allows approval from NEEDS_REVIEW with clean security scan', () => {
    expect(() => assertEvidenceCanBeApproved({ state: { status: 'NEEDS_REVIEW', securityScanStatus: 'CLEAN' }, env: { ...baseEnv, SECURITY_SCAN_MODE: 'required' } })).not.toThrow();
  });

  it('blocks approval if the evidence is not in NEEDS_REVIEW', () => {
    expect(() => assertEvidenceCanBeApproved({ state: { status: 'REJECTED', securityScanStatus: 'CLEAN' }, env: baseEnv })).toThrow(AppError);
  });

  it('blocks approval while malware scanning is still pending', () => {
    expect(() => assertEvidenceCanBeApproved({ state: { status: 'NEEDS_REVIEW', securityScanStatus: 'PENDING' }, env: { ...baseEnv, SECURITY_SCAN_MODE: 'required' } })).toThrow(AppError);
  });

  it('blocks approval after malicious scan verdict', () => {
    expect(() => assertEvidenceCanBeApproved({ state: { status: 'NEEDS_REVIEW', securityScanStatus: 'MALICIOUS' }, env: { ...baseEnv, SECURITY_SCAN_MODE: 'required' } })).toThrow(AppError);
  });

  it('allows rejection only from NEEDS_REVIEW', () => {
    expect(() => assertEvidenceCanBeRejected({ status: 'NEEDS_REVIEW' })).not.toThrow();
    expect(() => assertEvidenceCanBeRejected({ status: 'APPROVED' })).toThrow(AppError);
  });

  it('rejects invalid validity ranges', () => {
    const effectiveFrom = new Date('2026-08-08T00:00:00Z');
    const expiryDate = new Date('2026-08-07T00:00:00Z');
    expect(() => assertValidityRange({ effectiveFrom, expiryDate })).toThrow(AppError);
  });
});
