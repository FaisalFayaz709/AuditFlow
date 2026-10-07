import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalPrivateObjectStorage } from '../src/shared/storage.js';

describe('Pass 06 local private object storage', () => {
  it('writes and moves objects under the configured root only', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'auditflow-storage-'));
    try {
      const storage = new LocalPrivateObjectStorage(root);
      await storage.writeBuffer('tmp/a.txt', Buffer.from('hello'));
      expect(await storage.objectExists('tmp/a.txt')).toBe(true);
      await storage.moveObject('tmp/a.txt', 'evidence/a.txt');
      expect(await storage.objectExists('tmp/a.txt')).toBe(false);
      expect(await storage.objectExists('evidence/a.txt')).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects object keys that attempt path traversal', async () => {
    const storage = new LocalPrivateObjectStorage('/tmp/auditflow-storage-test');
    await expect(storage.writeBuffer('../escape.txt', Buffer.from('bad'))).rejects.toThrow();
  });
});
