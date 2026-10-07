export type StorageDriver = 'local' | 's3' | 'r2' | 'minio';

export type StoredObjectInfo = {
  key: string;
  size: number;
};

export type ShortLivedAccessUrl = {
  url: string;
  expiresAt: Date;
};

export type ObjectMetadata = {
  size?: number;
  contentType?: string;
  checksumSha256?: string;
  finalizedAt?: Date;
};

export type PrivateObjectStorage = {
  readonly driver: StorageDriver;
  writeBuffer(key: string, buffer: Buffer, metadata?: ObjectMetadata): Promise<StoredObjectInfo>;
  moveObject(sourceKey: string, destinationKey: string, metadata?: ObjectMetadata): Promise<void>;
  deleteObject(key: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
  createReadStream(key: string): NodeJS.ReadableStream;
  createShortLivedReadUrl?(key: string, ttlSeconds: number): Promise<ShortLivedAccessUrl>;
};

export function normalizeObjectKey(key: string): string {
  const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.includes('//')) {
    throw new Error('Invalid object storage key.');
  }
  return normalized;
}
