import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from '../src/shared/errors.js';
import { loadEnv } from '../src/config/env.js';
import {
  assertAllowedUpload,
  assertEvidenceDownloadSecurityClearance,
  isSecurityBlockedEvidenceStatus,
  makeEvidenceObjectKey,
  sanitizeDisplayFilename,
  sha256Hex,
} from '../src/modules/evidence/evidence-upload-policy.js';
import { decideInitialSecurityScan } from '../src/modules/evidence/security-scan-policy.js';
import { assertUploadChecksum, finalEvidenceStatusAfterObjectFinalization } from '../src/modules/evidence/upload-finalization-policy.js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceServiceSource = fs.readFileSync(path.join(repositoryRoot, 'backend/src/modules/evidence/evidence.service.ts'), 'utf8');
const schemaSource = fs.readFileSync(path.join(repositoryRoot, 'backend/prisma/schema.prisma'), 'utf8');

const baseEnv = loadEnv({
  DATABASE_URL: 'postgresql://example',
  SESSION_PEPPER: 'x'.repeat(40),
});

function schemaBlock(name: string): string {
  const match = schemaSource.match(new RegExp(`(?:model|enum)\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  if (!match) throw new Error(`${name} not found in Prisma schema`);
  return match[1];
}

describe('Pass 47 secure evidence upload, quarantine, and reconciliation runtime gate', () => {
  it('keeps object keys generated and independent from user-provided filenames or paths', () => {
    const displayName = sanitizeDisplayFilename('../finance/board password list.pdf');
    const temporaryKey = makeEvidenceObjectKey({ companyId: 'company_123', evidenceItemId: 'evidence_456', fileName: '../finance/board password list.pdf', temporary: true });
    const finalKey = makeEvidenceObjectKey({ companyId: 'company_123', evidenceItemId: 'evidence_456', fileName: '../finance/board password list.pdf' });

    expect(displayName).toBe('board password list.pdf');
    expect(temporaryKey).toMatch(/^companies\/company_123\/tmp\/evidence_456\/[0-9a-f-]{36}$/);
    expect(finalKey).toMatch(/^companies\/company_123\/evidence\/evidence_456\/[0-9a-f-]{36}$/);
    expect(temporaryKey).not.toContain('board');
    expect(temporaryKey).not.toContain('password');
    expect(finalKey).not.toContain('board');
    expect(finalKey).not.toContain('password');
    expect(finalKey).not.toContain('..');
  });

  it('enforces v2.1 upload validation before finalization', () => {
    const pdf = Buffer.from('%PDF-1.7\n% AuditFlow secure upload test\n');
    expect(() => assertAllowedUpload({ fileName: 'evidence.pdf', mimeType: 'application/pdf', buffer: pdf, maxBytes: 1024 })).not.toThrow();
    expect(() => assertAllowedUpload({ fileName: 'evidence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not-pdf'), maxBytes: 1024 })).toThrow(AppError);
    expect(() => assertAllowedUpload({ fileName: 'evidence.txt', mimeType: 'text/plain', buffer: Buffer.from('text\0with-null'), maxBytes: 1024 })).toThrow(AppError);
    expect(() => assertAllowedUpload({ fileName: 'large.txt', mimeType: 'text/plain', buffer: Buffer.from('ok'), maxBytes: 1 })).toThrow(AppError);
    expect(() => assertUploadChecksum({ expectedSha256: sha256Hex(pdf), actualSha256: sha256Hex(pdf) })).not.toThrow();
    expect(() => assertUploadChecksum({ expectedSha256: sha256Hex(pdf), actualSha256: sha256Hex(Buffer.from('tampered')) })).toThrow(AppError);
  });

  it('maps security scan outcomes to review, quarantine, or security rejection without auto-approval', async () => {
    await expect(decideInitialSecurityScan({
      env: { ...baseEnv, NODE_ENV: 'test', SECURITY_SCAN_MODE: 'required', SECURITY_SCAN_PROVIDER: 'fake' },
      buffer: Buffer.from('clean evidence'),
      fileName: 'clean.txt',
      mimeType: 'text/plain',
      sha256Checksum: 'abc',
    })).resolves.toMatchObject({ status: 'CLEAN', evidenceStatus: 'PROCESSING', provider: 'fake' });

    await expect(decideInitialSecurityScan({
      env: { ...baseEnv, NODE_ENV: 'test', SECURITY_SCAN_MODE: 'required', SECURITY_SCAN_PROVIDER: 'fake' },
      buffer: Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
      fileName: 'malicious.txt',
      mimeType: 'text/plain',
      sha256Checksum: 'abc',
    })).resolves.toMatchObject({ status: 'MALICIOUS', evidenceStatus: 'SECURITY_REJECTED', provider: 'fake' });

    await expect(decideInitialSecurityScan({
      env: { ...baseEnv, NODE_ENV: 'test', SECURITY_SCAN_MODE: 'required', SECURITY_SCAN_PROVIDER: 'fake' },
      buffer: Buffer.from('scanner fails'),
      fileName: 'unknown.txt',
      mimeType: 'text/plain',
      sha256Checksum: 'abc',
      scanner: {
        name: 'forced-failure',
        async scanBuffer() {
          return { verdict: 'FAILED', provider: 'forced-failure', scannedAt: new Date('2026-08-09T00:00:00Z'), reason: 'scanner timeout' };
        },
      },
    })).resolves.toMatchObject({ status: 'FAILED', evidenceStatus: 'QUARANTINED', provider: 'forced-failure' });

    expect(finalEvidenceStatusAfterObjectFinalization('PROCESSING')).toBe('NEEDS_REVIEW');
    expect(finalEvidenceStatusAfterObjectFinalization('QUARANTINED')).toBe('QUARANTINED');
    expect(finalEvidenceStatusAfterObjectFinalization('SECURITY_REJECTED')).toBe('SECURITY_REJECTED');
  });

  it('blocks downloads for quarantined and security-rejected evidence statuses', () => {
    expect(isSecurityBlockedEvidenceStatus('QUARANTINED')).toBe(true);
    expect(isSecurityBlockedEvidenceStatus('SECURITY_REJECTED')).toBe(true);
    expect(isSecurityBlockedEvidenceStatus('NEEDS_REVIEW')).toBe(false);
    expect(() => assertEvidenceDownloadSecurityClearance({ status: 'QUARANTINED' })).toThrow(AppError);
    expect(() => assertEvidenceDownloadSecurityClearance({ status: 'SECURITY_REJECTED' })).toThrow(AppError);
    expect(() => assertEvidenceDownloadSecurityClearance({ status: 'APPROVED' })).not.toThrow();
  });

  it('retains schema support for staged upload, object finalization, quarantine, and reconciliation', () => {
    for (const token of ['UPLOADED', 'QUARANTINED', 'SECURITY_REJECTED', 'PROCESSING', 'PROCESSING_FAILED', 'NEEDS_REVIEW', 'APPROVED']) {
      expect(schemaBlock('EvidenceVersionStatus')).toContain(token);
    }
    for (const token of ['NOT_REQUIRED', 'PENDING', 'CLEAN', 'MALICIOUS', 'FAILED']) {
      expect(schemaBlock('SecurityScanStatus')).toContain(token);
    }
    for (const token of ['CREATED', 'UPLOADED', 'VALIDATING', 'FINALIZING', 'FINALIZED', 'FAILED', 'EXPIRED']) {
      expect(schemaBlock('UploadIntentStatus')).toContain(token);
    }
    for (const field of ['security_scan_status', 'security_scan_completed_at', 'quarantine_reason', 'object_finalized_at', 'storage_reconciliation_required', 'storage_reconciliation_status']) {
      expect(schemaBlock('EvidenceVersion')).toContain(field);
    }
  });

  it('preserves the locked staged-upload ordering in the evidence service', () => {
    for (const token of [
      'uploadIntent.create',
      'temporaryStorageKey',
      'this.storage.writeBuffer(temporaryStorageKey',
      "status: 'UPLOADED'",
      "status: 'VALIDATING'",
      'assertUploadChecksum',
      'decideInitialSecurityScan',
      "status: 'FINALIZING'",
      'evidenceVersion.create',
      'this.storage.moveObject(temporaryStorageKey, finalStorageKey',
      'object_finalized_at: new Date()',
      "status: 'FINALIZED'",
      'assertEvidenceDownloadSecurityClearance',
      'EVIDENCE_OBJECT_NOT_FINALIZED',
      'EVIDENCE_OBJECT_MISSING',
    ]) {
      expect(evidenceServiceSource).toContain(token);
    }

    expect(evidenceServiceSource.indexOf('this.storage.writeBuffer(temporaryStorageKey')).toBeLessThan(evidenceServiceSource.indexOf('assertUploadChecksum'));
    expect(evidenceServiceSource.indexOf('decideInitialSecurityScan')).toBeLessThan(evidenceServiceSource.indexOf('evidenceVersion.create'));
    expect(evidenceServiceSource.indexOf('evidenceVersion.create')).toBeLessThan(evidenceServiceSource.indexOf('this.storage.moveObject(temporaryStorageKey, finalStorageKey'));
    expect(evidenceServiceSource.indexOf('this.storage.moveObject(temporaryStorageKey, finalStorageKey')).toBeLessThan(evidenceServiceSource.indexOf('object_finalized_at: new Date()'));
  });
});
