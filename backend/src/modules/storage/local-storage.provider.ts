import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeObjectKey, type ObjectMetadata, type PrivateObjectStorage, type ShortLivedAccessUrl, type StoredObjectInfo } from './storage.types.js';

function resolveInsideRoot(root: string, key: string): string {
  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, normalizeObjectKey(key));
  if (!resolved.startsWith(normalizedRoot + path.sep)) {
    throw new Error('Object key escapes storage root.');
  }
  return resolved;
}

export class LocalPrivateObjectStorage implements PrivateObjectStorage {
  readonly driver = 'local' as const;

  constructor(private readonly root: string) {}

  async writeBuffer(key: string, buffer: Buffer, _metadata?: ObjectMetadata): Promise<StoredObjectInfo> {
    const objectKey = normalizeObjectKey(key);
    const filePath = resolveInsideRoot(this.root, objectKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer, { flag: 'wx' });
    return { key: objectKey, size: buffer.length };
  }

  async moveObject(sourceKey: string, destinationKey: string, _metadata?: ObjectMetadata): Promise<void> {
    const sourcePath = resolveInsideRoot(this.root, sourceKey);
    const destinationPath = resolveInsideRoot(this.root, destinationKey);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await rename(sourcePath, destinationPath);
  }

  async deleteObject(key: string): Promise<void> {
    await rm(resolveInsideRoot(this.root, key), { force: true });
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await stat(resolveInsideRoot(this.root, key));
      return true;
    } catch {
      return false;
    }
  }

  createReadStream(key: string): NodeJS.ReadableStream {
    return createReadStream(resolveInsideRoot(this.root, key));
  }

  async createShortLivedReadUrl(_key: string, _ttlSeconds: number): Promise<ShortLivedAccessUrl> {
    throw new Error('Local storage does not issue direct access URLs. Use backend streaming authorization.');
  }
}
