import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import { assertAllowedUpload, deriveTitleFromUpload, sanitizeDisplayFilename, sha256Hex } from '../src/modules/evidence/evidence-upload-policy.js';

const pdf = Buffer.from('%PDF-1.7\n% AuditFlow test PDF\n');

describe('Pass 06 evidence upload policy', () => {
  it('accepts allowed MVP PDF uploads with matching extension and content signature', () => {
    expect(() => assertAllowedUpload({ fileName: 'policy.pdf', mimeType: 'application/pdf', buffer: pdf, maxBytes: 25 * 1024 * 1024 })).not.toThrow();
  });

  it('rejects unsupported MVP types such as DOCX until Phase 2 extraction/security support exists', () => {
    expect(() => assertAllowedUpload({ fileName: 'policy.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('PK'), maxBytes: 1000 })).toThrow(AppError);
  });

  it('rejects MIME/extension mismatches', () => {
    expect(() => assertAllowedUpload({ fileName: 'policy.txt', mimeType: 'application/pdf', buffer: pdf, maxBytes: 1000 })).toThrow(AppError);
  });

  it('rejects content-signature mismatches', () => {
    expect(() => assertAllowedUpload({ fileName: 'policy.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf'), maxBytes: 1000 })).toThrow(AppError);
  });

  it('calculates a stable sha256 checksum for duplicate/integrity checks', () => {
    expect(sha256Hex(Buffer.from('auditflow'))).toBe(sha256Hex(Buffer.from('auditflow')));
  });

  it('sanitizes path-like filenames before display/storage use', () => {
    expect(sanitizeDisplayFilename('../secret/policy.pdf')).toBe('policy.pdf');
    expect(deriveTitleFromUpload({ fileName: 'policy.pdf' })).toBe('policy');
  });
});
