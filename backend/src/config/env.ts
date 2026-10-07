import { z } from 'zod';
import { collectOperationalGateFailures } from '../shared/operational-gate.js';

const optionalString = z.preprocess((value) => value === '' ? undefined : value, z.string().optional());
const optionalUrl = z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional());

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  STRUCTURED_LOG_FORMAT: z.enum(['json']).default('json'),
  DATABASE_SSL_REQUIRED: z.coerce.boolean().default(false),
  DATABASE_PITR_ENABLED: z.coerce.boolean().default(false),
  SECRET_MANAGER_PROVIDER: z.enum(['local', 'platform', 'aws-secrets-manager', 'gcp-secret-manager', 'azure-key-vault', 'vault']).default('local'),
  LAST_RESTORE_TEST_STATUS: z.enum(['NOT_RUN', 'FAILED', 'PASSED']).default('NOT_RUN'),
  SESSION_PEPPER: z.string().min(32).default('development_session_pepper_change_before_staging'),
  SESSION_IDLE_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 12),
  SESSION_ABSOLUTE_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  CSRF_TOKEN_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 12),
  PASSWORD_RESET_TOKEN_SECONDS: z.coerce.number().int().positive().default(60 * 30),
  EMAIL_VERIFICATION_TOKEN_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24),
  STORAGE_DRIVER: z.enum(['local', 's3', 'r2', 'minio']).default('local'),
  STORAGE_LOCAL_ROOT: z.string().min(1).default('./.auditflow-storage'),
  STORAGE_BUCKET: optionalString,
  STORAGE_REGION: z.string().min(1).default('auto'),
  STORAGE_ENDPOINT: optionalUrl,
  STORAGE_ACCESS_KEY_ID: optionalString,
  STORAGE_SECRET_ACCESS_KEY: optionalString,
  STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().max(900).default(300),
  STORAGE_SERVER_SIDE_ENCRYPTION: z.enum(['AES256', 'aws:kms']).optional(),
  STORAGE_KMS_KEY_ID: optionalString,
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  SECURITY_SCAN_MODE: z.enum(['disabled_non_production', 'required']).default('disabled_non_production'),
  SECURITY_SCAN_PROVIDER: z.enum(['fake', 'clamav']).default('fake'),
  SECURITY_SCAN_ALLOW_NON_PRODUCTION_BYPASS: z.coerce.boolean().default(true),
  CLAMAV_HOST: z.string().min(1).default('127.0.0.1'),
  CLAMAV_PORT: z.coerce.number().int().positive().max(65535).default(3310),
  CLAMAV_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
  UPLOAD_INTENT_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60),

  AI_PROVIDER: z.enum(['mock', 'disabled']).default('mock'),
  AI_DEFAULT_ENABLED: z.coerce.boolean().default(false),
  AI_PROMPT_VERSION: z.string().min(1).default('auditflow-evidence-analysis-v1'),
  AI_MODEL_NAME: z.string().min(1).default('auditflow-mock-v1'),
  AI_MAX_INPUT_CHARS: z.coerce.number().int().positive().max(100_000).default(12_000),
  AI_RELEASE_GATE_STATUS: z.enum(['BLOCKED', 'APPROVED']).default('BLOCKED'),
  AI_RELEASE_GATE_APPROVAL_REFERENCE: optionalString,
  AI_EVALUATION_CORPUS_VERSION: z.string().min(1).default('auditflow-ai-eval-corpus-v1-pass-53'),

  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JOBS_ENABLED: z.coerce.boolean().default(false),
  JOB_WORKER_CONCURRENCY: z.coerce.number().int().positive().max(25).default(3),
  JOB_REMOVE_ON_COMPLETE_COUNT: z.coerce.number().int().nonnegative().default(1000),
  JOB_REMOVE_ON_FAIL_COUNT: z.coerce.number().int().nonnegative().default(1000),
  NOTIFICATION_EMAIL_PROVIDER: z.enum(['fake']).default('fake'),
  NOTIFICATION_DEFAULT_CHANNEL: z.enum(['EMAIL']).default('EMAIL'),
  NOTIFICATION_MAX_ATTEMPTS: z.coerce.number().int().positive().max(10).default(5),
  NOTIFICATION_BASE_BACKOFF_SECONDS: z.coerce.number().int().positive().max(3600).default(60),
  NOTIFICATION_MAX_BACKOFF_SECONDS: z.coerce.number().int().positive().max(86400).default(3600),
  NOTIFICATION_DELIVERY_LOCK_SECONDS: z.coerce.number().int().positive().max(3600).default(300),
  EXPIRING_EVIDENCE_THRESHOLD_DAYS: z.coerce.number().int().positive().default(30),
  TASK_DUE_SOON_DAYS: z.coerce.number().int().positive().default(3),


  // Pass 19 deployment, observability, and operational readiness controls.
  APP_VERSION: z.string().min(1).default('0.1.0'),
  RELEASE_ID: z.string().min(1).default('local-dev'),
  COMMIT_SHA: z.string().min(1).default('local'),
  READINESS_CHECK_DATABASE: z.coerce.boolean().default(true),
  READINESS_CHECK_REDIS: z.coerce.boolean().default(false),
  OBSERVABILITY_ERROR_TRACKING_DSN: z.string().url().optional(),
  OBSERVABILITY_UPTIME_CHECK_URL: z.string().url().optional(),
  BACKUP_POLICY_NAME: z.string().min(1).default('portfolio-mvp-best-effort'),
  RESTORE_TEST_REQUIRED_BEFORE_CUSTOMER_DATA: z.coerce.boolean().default(true),

  // Pass 20 production non-functional gate. Real customer evidence remains blocked
  // until the go-live gate is approved and explicitly enabled.
  CUSTOMER_EVIDENCE_ENABLED: z.coerce.boolean().default(false),
  PRODUCTION_GATE_STATUS: z.enum(['BLOCKED', 'APPROVED']).default('BLOCKED'),
  PRODUCTION_GATE_APPROVAL_REFERENCE: z.string().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

function validateStorageConfiguration(env: AppEnv): void {
  const externalDriver = env.STORAGE_DRIVER !== 'local';

  if (env.NODE_ENV === 'production' && env.STORAGE_DRIVER === 'local') {
    throw new Error('Invalid environment configuration: production evidence storage must use s3, r2, or minio.');
  }

  if (externalDriver) {
    const missing = [
      ['STORAGE_BUCKET', env.STORAGE_BUCKET],
      ['STORAGE_ACCESS_KEY_ID', env.STORAGE_ACCESS_KEY_ID],
      ['STORAGE_SECRET_ACCESS_KEY', env.STORAGE_SECRET_ACCESS_KEY],
    ].filter(([, value]) => !value).map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`Invalid environment configuration: ${env.STORAGE_DRIVER} storage missing ${missing.join(', ')}.`);
    }
  }

  if ((env.STORAGE_DRIVER === 'r2' || env.STORAGE_DRIVER === 'minio') && !env.STORAGE_ENDPOINT) {
    throw new Error(`Invalid environment configuration: ${env.STORAGE_DRIVER} storage requires STORAGE_ENDPOINT.`);
  }

  if (env.STORAGE_DRIVER === 'minio' && !env.STORAGE_FORCE_PATH_STYLE) {
    throw new Error('Invalid environment configuration: minio storage requires STORAGE_FORCE_PATH_STYLE=true.');
  }

  if (env.STORAGE_SERVER_SIDE_ENCRYPTION === 'aws:kms' && !env.STORAGE_KMS_KEY_ID) {
    throw new Error('Invalid environment configuration: aws:kms storage encryption requires STORAGE_KMS_KEY_ID.');
  }
}


function validateSecurityScanConfiguration(env: AppEnv): void {
  const elevatedEnvironment = env.NODE_ENV === 'staging' || env.NODE_ENV === 'production';

  if (elevatedEnvironment && env.SECURITY_SCAN_MODE !== 'required') {
    throw new Error('Invalid environment configuration: staging/production evidence workflows require SECURITY_SCAN_MODE=required.');
  }

  if (elevatedEnvironment && env.SECURITY_SCAN_PROVIDER === 'fake') {
    throw new Error('Invalid environment configuration: staging/production evidence workflows require a real SECURITY_SCAN_PROVIDER such as clamav.');
  }

  if (env.NODE_ENV === 'production' && env.SECURITY_SCAN_ALLOW_NON_PRODUCTION_BYPASS) {
    throw new Error('Invalid environment configuration: production forbids SECURITY_SCAN_ALLOW_NON_PRODUCTION_BYPASS=true.');
  }

  if (env.SECURITY_SCAN_MODE === 'disabled_non_production' && elevatedEnvironment) {
    throw new Error('Invalid environment configuration: scan bypass is allowed only in local/test environments.');
  }
}


function validateAiReleaseGateConfiguration(env: AppEnv): void {
  const elevatedEnvironment = env.NODE_ENV === 'staging' || env.NODE_ENV === 'production';
  if (!elevatedEnvironment || env.AI_PROVIDER === 'disabled') return;

  if (env.AI_RELEASE_GATE_STATUS !== 'APPROVED') {
    throw new Error('Invalid environment configuration: staging/production AI requires AI_RELEASE_GATE_STATUS=APPROVED after regression evaluation.');
  }

  if (!env.AI_RELEASE_GATE_APPROVAL_REFERENCE?.trim()) {
    throw new Error('Invalid environment configuration: AI_RELEASE_GATE_APPROVAL_REFERENCE is required when staging/production AI is enabled.');
  }
}


function validateOperationalGateConfiguration(env: AppEnv): void {
  const failures = collectOperationalGateFailures(env);
  if (failures.length > 0) {
    throw new Error(`Invalid environment configuration: operational gate failed: ${JSON.stringify(failures)}`);
  }
}

export function loadEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.safeParse(input);

  if (!parsed.success) {
    // Deliberately avoid printing secrets or entire environment values.
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new Error(`Invalid environment configuration: ${JSON.stringify(issues)}`);
  }

  validateStorageConfiguration(parsed.data);
  validateSecurityScanConfiguration(parsed.data);
  validateAiReleaseGateConfiguration(parsed.data);
  validateOperationalGateConfiguration(parsed.data);
  return parsed.data;
}
