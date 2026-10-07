import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';
import { createPrivateObjectStorage } from '../src/modules/storage/storage.factory.js';
import { LocalPrivateObjectStorage } from '../src/modules/storage/local-storage.provider.js';
import { normalizeObjectKey } from '../src/modules/storage/storage.types.js';

const baseEnv = {
  DATABASE_URL: 'postgresql://auditflow:auditflow_dev_password@localhost:5432/auditflow_dev?schema=public',
  SESSION_PEPPER: 'x'.repeat(40),
};

describe('Pass 25 production object storage policy', () => {
  it('keeps local storage private and prevents path traversal', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'auditflow-pass25-'));
    try {
      const storage = new LocalPrivateObjectStorage(root);
      await storage.writeBuffer('companies/c1/tmp/file.txt', Buffer.from('private evidence'));
      await storage.moveObject('companies/c1/tmp/file.txt', 'companies/c1/evidence/file.txt');
      expect(await storage.objectExists('companies/c1/evidence/file.txt')).toBe(true);
      await expect(readFile(path.join(root, 'companies/c1/evidence/file.txt'), 'utf8')).resolves.toBe('private evidence');
      expect(() => normalizeObjectKey('../escape.txt')).toThrow(/Invalid object storage key/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects production local storage', () => {
    expect(() => loadEnv({ ...baseEnv, NODE_ENV: 'production', STORAGE_DRIVER: 'local' })).toThrow(/production evidence storage must use s3, r2, or minio/);
  });

  it('requires bucket and credentials for S3-compatible drivers', () => {
    expect(() => loadEnv({ ...baseEnv, STORAGE_DRIVER: 's3' })).toThrow(/storage missing STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY/);
  });

  it('requires endpoints for r2 and minio', () => {
    expect(() => loadEnv({
      ...baseEnv,
      STORAGE_DRIVER: 'r2',
      STORAGE_BUCKET: 'auditflow',
      STORAGE_ACCESS_KEY_ID: 'key',
      STORAGE_SECRET_ACCESS_KEY: 'secret',
    })).toThrow(/r2 storage requires STORAGE_ENDPOINT/);
  });

  it('creates the correct provider for local storage', () => {
    const env = loadEnv({ ...baseEnv, STORAGE_DRIVER: 'local', STORAGE_LOCAL_ROOT: './.tmp-storage' });
    expect(createPrivateObjectStorage(env).driver).toBe('local');
  });
});
