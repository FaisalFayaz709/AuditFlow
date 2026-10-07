import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../src/config/env.js';
import { collectOperationalGateFailures } from '../src/shared/operational-gate.js';

const baseEnv: AppEnv = {
  NODE_ENV: 'production',
  PORT: 4000,
  HOST: '0.0.0.0',
  DATABASE_URL: 'postgresql://example.invalid/auditflow',
  FRONTEND_ORIGIN: 'https://app.auditflow.example',
  LOG_LEVEL: 'info',
  STRUCTURED_LOG_FORMAT: 'json',
  DATABASE_SSL_REQUIRED: true,
  DATABASE_PITR_ENABLED: true,
  SECRET_MANAGER_PROVIDER: 'platform',
  LAST_RESTORE_TEST_STATUS: 'PASSED',
  SESSION_PEPPER: 'production-secret-pepper-with-at-least-32-characters',
  SESSION_IDLE_SECONDS: 43200,
  SESSION_ABSOLUTE_SECONDS: 604800,
  CSRF_TOKEN_SECONDS: 43200,
  PASSWORD_RESET_TOKEN_SECONDS: 1800,
  EMAIL_VERIFICATION_TOKEN_SECONDS: 86400,
  STORAGE_DRIVER: 's3',
  STORAGE_LOCAL_ROOT: './.auditflow-storage',
  STORAGE_BUCKET: 'auditflow-evidence-private',
  STORAGE_REGION: 'us-east-1',
  STORAGE_ENDPOINT: undefined,
  STORAGE_ACCESS_KEY_ID: 'access',
  STORAGE_SECRET_ACCESS_KEY: 'secret',
  STORAGE_FORCE_PATH_STYLE: false,
  STORAGE_SIGNED_URL_TTL_SECONDS: 300,
  STORAGE_SERVER_SIDE_ENCRYPTION: 'AES256',
  STORAGE_KMS_KEY_ID: undefined,
  MAX_UPLOAD_BYTES: 26214400,
  SECURITY_SCAN_MODE: 'required',
  SECURITY_SCAN_PROVIDER: 'clamav',
  SECURITY_SCAN_ALLOW_NON_PRODUCTION_BYPASS: false,
  CLAMAV_HOST: 'clamav.internal',
  CLAMAV_PORT: 3310,
  CLAMAV_TIMEOUT_MS: 10000,
  UPLOAD_INTENT_TTL_SECONDS: 3600,
  AI_PROVIDER: 'disabled',
  AI_DEFAULT_ENABLED: false,
  AI_PROMPT_VERSION: 'auditflow-evidence-analysis-v1',
  AI_MODEL_NAME: 'auditflow-mock-v1',
  AI_MAX_INPUT_CHARS: 12000,
  AI_RELEASE_GATE_STATUS: 'BLOCKED',
  AI_RELEASE_GATE_APPROVAL_REFERENCE: undefined,
  AI_EVALUATION_CORPUS_VERSION: 'auditflow-ai-eval-corpus-v1-pass-36',
  REDIS_URL: 'redis://localhost:6379',
  JOBS_ENABLED: false,
  JOB_WORKER_CONCURRENCY: 3,
  JOB_REMOVE_ON_COMPLETE_COUNT: 1000,
  JOB_REMOVE_ON_FAIL_COUNT: 1000,
  NOTIFICATION_EMAIL_PROVIDER: 'fake',
  NOTIFICATION_DEFAULT_CHANNEL: 'EMAIL',
  NOTIFICATION_MAX_ATTEMPTS: 5,
  NOTIFICATION_BASE_BACKOFF_SECONDS: 60,
  NOTIFICATION_MAX_BACKOFF_SECONDS: 3600,
  NOTIFICATION_DELIVERY_LOCK_SECONDS: 300,
  EXPIRING_EVIDENCE_THRESHOLD_DAYS: 30,
  TASK_DUE_SOON_DAYS: 3,
  APP_VERSION: '0.1.0',
  RELEASE_ID: 'release-2026-08-09-001',
  COMMIT_SHA: 'abcdef1234567890',
  READINESS_CHECK_DATABASE: true,
  READINESS_CHECK_REDIS: false,
  OBSERVABILITY_ERROR_TRACKING_DSN: undefined,
  OBSERVABILITY_UPTIME_CHECK_URL: undefined,
  BACKUP_POLICY_NAME: 'managed-postgres-pitr-production',
  RESTORE_TEST_REQUIRED_BEFORE_CUSTOMER_DATA: true,
  CUSTOMER_EVIDENCE_ENABLED: false,
  PRODUCTION_GATE_STATUS: 'BLOCKED',
  PRODUCTION_GATE_APPROVAL_REFERENCE: undefined,
};

describe('Pass 38 operational boot gate', () => {
  it('accepts a production-like configuration with private storage, scanner, database, secret, release, and restore controls', () => {
    expect(collectOperationalGateFailures(baseEnv)).toEqual([]);
  });

  it('rejects localhost frontend origin, local storage, fake scanner, weak secrets, missing database controls, and missing restore proof', () => {
    const failures = collectOperationalGateFailures({
      ...baseEnv,
      FRONTEND_ORIGIN: 'http://localhost:5173',
      SESSION_PEPPER: 'development_session_pepper_change_before_staging',
      STORAGE_DRIVER: 'local',
      SECURITY_SCAN_PROVIDER: 'fake',
      DATABASE_SSL_REQUIRED: false,
      DATABASE_PITR_ENABLED: false,
      SECRET_MANAGER_PROVIDER: 'local',
      RELEASE_ID: 'local-dev',
      COMMIT_SHA: 'local',
      BACKUP_POLICY_NAME: 'portfolio-mvp-best-effort',
      LAST_RESTORE_TEST_STATUS: 'NOT_RUN',
    });

    expect(failures.join('\n')).toContain('FRONTEND_ORIGIN');
    expect(failures.join('\n')).toContain('SESSION_PEPPER');
    expect(failures.join('\n')).toContain('object storage');
    expect(failures.join('\n')).toContain('Malware/security scanning');
    expect(failures.join('\n')).toContain('DATABASE_SSL_REQUIRED');
    expect(failures.join('\n')).toContain('DATABASE_PITR_ENABLED');
    expect(failures.join('\n')).toContain('SECRET_MANAGER_PROVIDER');
    expect(failures.join('\n')).toContain('RELEASE_ID');
    expect(failures.join('\n')).toContain('BACKUP_POLICY_NAME');
    expect(failures.join('\n')).toContain('LAST_RESTORE_TEST_STATUS');
  });
});
