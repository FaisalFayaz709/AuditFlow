import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';
import { createSecurityScanProvider } from '../src/modules/security-scan/security-scan.factory.js';

const baseInput = {
  DATABASE_URL: 'postgresql://auditflow:auditflow_dev_password@localhost:5432/auditflow_dev?schema=public',
  SESSION_PEPPER: 'x'.repeat(40),
};

describe('Pass 26 scanner environment gate', () => {
  it('rejects staging scanner bypass', () => {
    expect(() => loadEnv({ ...baseInput, NODE_ENV: 'staging', SECURITY_SCAN_MODE: 'disabled_non_production' })).toThrow(/SECURITY_SCAN_MODE=required/);
  });

  it('rejects staging fake scanner even when scanning is required', () => {
    expect(() => loadEnv({ ...baseInput, NODE_ENV: 'staging', SECURITY_SCAN_MODE: 'required', SECURITY_SCAN_PROVIDER: 'fake' })).toThrow(/real SECURITY_SCAN_PROVIDER/);
  });

  it('rejects production non-production bypass flag', () => {
    expect(() => loadEnv({
      ...baseInput,
      NODE_ENV: 'production',
      STORAGE_DRIVER: 's3',
      STORAGE_BUCKET: 'auditflow',
      STORAGE_ACCESS_KEY_ID: 'key',
      STORAGE_SECRET_ACCESS_KEY: 'secret',
      SECURITY_SCAN_MODE: 'required',
      SECURITY_SCAN_PROVIDER: 'clamav',
      SECURITY_SCAN_ALLOW_NON_PRODUCTION_BYPASS: 'true',
    })).toThrow(/forbids SECURITY_SCAN_ALLOW_NON_PRODUCTION_BYPASS/);
  });

  it('allows production only with required real scanner configuration', () => {
    const env = loadEnv({
      ...baseInput,
      NODE_ENV: 'production',
      STORAGE_DRIVER: 's3',
      STORAGE_BUCKET: 'auditflow',
      STORAGE_ACCESS_KEY_ID: 'key',
      STORAGE_SECRET_ACCESS_KEY: 'secret',
      SECURITY_SCAN_MODE: 'required',
      SECURITY_SCAN_PROVIDER: 'clamav',
      SECURITY_SCAN_ALLOW_NON_PRODUCTION_BYPASS: 'false',
      CLAMAV_HOST: 'clamav.internal',
      CLAMAV_PORT: '3310',
    });
    expect(env.SECURITY_SCAN_PROVIDER).toBe('clamav');
  });

  it('creates fake provider only for local/test environments', () => {
    const env = loadEnv({ ...baseInput, NODE_ENV: 'test', SECURITY_SCAN_MODE: 'required', SECURITY_SCAN_PROVIDER: 'fake' });
    expect(createSecurityScanProvider(env).name).toBe('fake');
  });
});
