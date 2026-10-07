import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import { loadEnv } from '../src/config/env.js';
import { decideInitialSecurityScan } from '../src/modules/evidence/security-scan-policy.js';
import { FakeSecurityScanProvider } from '../src/modules/security-scan/fake-scanner.provider.js';

const baseInput = {
  DATABASE_URL: 'postgresql://example',
  SESSION_PEPPER: 'x'.repeat(40),
};

const baseEnv = loadEnv(baseInput);

describe('Pass 26 security scan policy', () => {
  it('allows explicit non-production scanner bypass as NOT_REQUIRED while retaining provenance', async () => {
    await expect(decideInitialSecurityScan({
      env: baseEnv,
      buffer: Buffer.from('safe'),
      fileName: 'a.txt',
      sha256Checksum: 'abc',
    })).resolves.toMatchObject({
      status: 'NOT_REQUIRED',
      evidenceStatus: 'PROCESSING',
      provider: 'bypass',
      bypassed: true,
    });
  });

  it('uses the fake scanner in local/test required mode and marks clean files CLEAN', async () => {
    await expect(decideInitialSecurityScan({
      env: { ...baseEnv, NODE_ENV: 'test', SECURITY_SCAN_MODE: 'required', SECURITY_SCAN_PROVIDER: 'fake' },
      buffer: Buffer.from('safe'),
      fileName: 'a.txt',
      sha256Checksum: 'abc',
    })).resolves.toMatchObject({
      status: 'CLEAN',
      evidenceStatus: 'PROCESSING',
      provider: 'fake',
    });
  });

  it('sends EICAR test marker to SECURITY_REJECTED branch', async () => {
    await expect(decideInitialSecurityScan({
      env: { ...baseEnv, NODE_ENV: 'test', SECURITY_SCAN_MODE: 'required', SECURITY_SCAN_PROVIDER: 'fake' },
      buffer: Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
      fileName: 'bad.txt',
      sha256Checksum: 'abc',
    })).resolves.toMatchObject({
      status: 'MALICIOUS',
      evidenceStatus: 'SECURITY_REJECTED',
      provider: 'fake',
    });
  });

  it('keeps scan failures quarantined instead of approving or exposing them', async () => {
    await expect(decideInitialSecurityScan({
      env: { ...baseEnv, NODE_ENV: 'test', SECURITY_SCAN_MODE: 'required', SECURITY_SCAN_PROVIDER: 'fake' },
      buffer: Buffer.from('safe'),
      fileName: 'a.txt',
      sha256Checksum: 'abc',
      scanner: {
        name: 'failing-test-scanner',
        async scanBuffer() {
          return { verdict: 'FAILED', provider: 'failing-test-scanner', scannedAt: new Date(), reason: 'scanner unavailable' };
        },
      },
    })).resolves.toMatchObject({
      status: 'FAILED',
      evidenceStatus: 'QUARANTINED',
      provider: 'failing-test-scanner',
    });
  });

  it('blocks production upload when malware scanning is not configured as required', async () => {
    await expect(decideInitialSecurityScan({
      env: { ...baseEnv, NODE_ENV: 'production', SECURITY_SCAN_MODE: 'disabled_non_production', SECURITY_SCAN_ALLOW_NON_PRODUCTION_BYPASS: false },
      buffer: Buffer.from('safe'),
      fileName: 'a.txt',
      sha256Checksum: 'abc',
    })).rejects.toThrow(AppError);
  });

  it('fake scanner detects EICAR directly for provider-level tests', async () => {
    await expect(new FakeSecurityScanProvider().scanBuffer({
      fileName: 'bad.txt',
      buffer: Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
      sha256Checksum: 'abc',
    })).resolves.toMatchObject({ verdict: 'MALICIOUS', signature: 'EICAR.TEST.MARKER' });
  });
});
