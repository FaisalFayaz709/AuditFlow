import { Readable } from 'node:stream';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type ServerSideEncryption,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { normalizeObjectKey, type ObjectMetadata, type PrivateObjectStorage, type ShortLivedAccessUrl, type StorageDriver, type StoredObjectInfo } from './storage.types.js';

export type S3CompatiblePrivateObjectStorageOptions = {
  driver: Exclude<StorageDriver, 'local'>;
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  signedUrlTtlSeconds: number;
  serverSideEncryption?: ServerSideEncryption;
  kmsKeyId?: string;
};

function encodeCopySource(bucket: string, key: string): string {
  return `${bucket}/${normalizeObjectKey(key).split('/').map(encodeURIComponent).join('/')}`;
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { name?: string; '$metadata'?: { httpStatusCode?: number } };
  return maybe.name === 'NotFound' || maybe.name === 'NoSuchKey' || maybe['$metadata']?.httpStatusCode === 404;
}

function assertReadable(body: unknown): NodeJS.ReadableStream {
  if (body instanceof Readable) return body;
  if (body && typeof (body as { pipe?: unknown }).pipe === 'function') {
    return body as NodeJS.ReadableStream;
  }
  throw new Error('Object storage response body is not a Node.js readable stream.');
}

export class S3CompatiblePrivateObjectStorage implements PrivateObjectStorage {
  readonly driver: Exclude<StorageDriver, 'local'>;
  private readonly client: S3Client;

  constructor(private readonly options: S3CompatiblePrivateObjectStorageOptions) {
    this.driver = options.driver;
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async writeBuffer(key: string, buffer: Buffer, metadata?: ObjectMetadata): Promise<StoredObjectInfo> {
    const objectKey = normalizeObjectKey(key);
    await this.client.send(new PutObjectCommand({
      Bucket: this.options.bucket,
      Key: objectKey,
      Body: buffer,
      ContentLength: buffer.length,
      ContentType: metadata?.contentType,
      Metadata: {
        ...(metadata?.checksumSha256 ? { sha256: metadata.checksumSha256 } : {}),
        ...(metadata?.finalizedAt ? { finalized_at: metadata.finalizedAt.toISOString() } : {}),
      },
      ServerSideEncryption: this.options.serverSideEncryption,
      SSEKMSKeyId: this.options.kmsKeyId,
    }));
    return { key: objectKey, size: buffer.length };
  }

  async moveObject(sourceKey: string, destinationKey: string, metadata?: ObjectMetadata): Promise<void> {
    const normalizedSource = normalizeObjectKey(sourceKey);
    const normalizedDestination = normalizeObjectKey(destinationKey);
    await this.client.send(new CopyObjectCommand({
      Bucket: this.options.bucket,
      Key: normalizedDestination,
      CopySource: encodeCopySource(this.options.bucket, normalizedSource),
      MetadataDirective: 'REPLACE',
      ContentType: metadata?.contentType,
      Metadata: {
        ...(metadata?.checksumSha256 ? { sha256: metadata.checksumSha256 } : {}),
        ...(metadata?.finalizedAt ? { finalized_at: metadata.finalizedAt.toISOString() } : {}),
      },
      ServerSideEncryption: this.options.serverSideEncryption,
      SSEKMSKeyId: this.options.kmsKeyId,
    }));
    await this.deleteObject(normalizedSource);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: normalizeObjectKey(key) }));
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.options.bucket, Key: normalizeObjectKey(key) }));
      return true;
    } catch (error) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  createReadStream(key: string): NodeJS.ReadableStream {
    const command = new GetObjectCommand({ Bucket: this.options.bucket, Key: normalizeObjectKey(key) });
    const streamPromise = this.client.send(command).then((response) => assertReadable(response.Body));
    const proxy = new Readable({ read() { /* data is pushed from the S3 response stream. */ } });
    streamPromise.then((source) => source.on('data', (chunk) => proxy.push(chunk)).on('end', () => proxy.push(null)).on('error', (error) => proxy.destroy(error))).catch((error) => proxy.destroy(error));
    return proxy;
  }

  async createShortLivedReadUrl(key: string, ttlSeconds: number): Promise<ShortLivedAccessUrl> {
    const boundedTtl = Math.min(Math.max(1, ttlSeconds), this.options.signedUrlTtlSeconds);
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.options.bucket, Key: normalizeObjectKey(key) }),
      { expiresIn: boundedTtl },
    );
    return { url, expiresAt: new Date(Date.now() + boundedTtl * 1000) };
  }
}
