import type { AppEnv } from '../../config/env.js';
import { LocalPrivateObjectStorage } from './local-storage.provider.js';
import { S3CompatiblePrivateObjectStorage } from './s3-compatible-storage.provider.js';
import type { PrivateObjectStorage } from './storage.types.js';

export function createPrivateObjectStorage(env: AppEnv): PrivateObjectStorage {
  if (env.STORAGE_DRIVER === 'local') {
    return new LocalPrivateObjectStorage(env.STORAGE_LOCAL_ROOT);
  }

  return new S3CompatiblePrivateObjectStorage({
    driver: env.STORAGE_DRIVER,
    bucket: env.STORAGE_BUCKET!,
    region: env.STORAGE_REGION,
    endpoint: env.STORAGE_ENDPOINT,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY!,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    signedUrlTtlSeconds: env.STORAGE_SIGNED_URL_TTL_SECONDS,
    serverSideEncryption: env.STORAGE_SERVER_SIDE_ENCRYPTION,
    kmsKeyId: env.STORAGE_KMS_KEY_ID,
  });
}
