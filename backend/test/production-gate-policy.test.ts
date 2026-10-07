import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../src/config/env.js';
import { assertProductionCustomerEvidenceGateOpen } from '../src/shared/production-gate.js';

const baseEnv: AppEnv = {
  NODE_ENV: 'production',
  PORT: 4000,
  HOST: '127.0.0.1',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  LOG_LEVEL: 'silent',
  SESSION_PEPPER: 'x'.repeat(32),
  SESSION_IDLE_SECONDS: 60 * 60 * 12,
  SESSION_ABSOLUTE_SECONDS: 60 * 60 * 24 * 7,
  CSRF_TOKEN_SECONDS: 60 * 60 * 12,
  PASSWORD_RESET_TOKEN_SECONDS: 60 * 30,
  EMAIL_VERIFICATION_TOKEN_SECONDS: 60 * 60 * 24,
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_ROOT: './tmp',
  MAX_UPLOAD_BYTES: 25 * 1024 * 1024,
  SECURITY_SCAN_MODE: 'required',
  SECURITY_SCAN_PROVIDER: 'clamav',
  SECURITY_SCAN_ALLOW_NON_PRODUCTION_BYPASS: false,
  CLAMAV_HOST: '127.0.0.1',
  CLAMAV_PORT: 3310,
  CLAMAV_TIMEOUT_MS: 10_000,
  UPLOAD_INTENT_TTL_SECONDS: 60 * 60,
  AI_PROVIDER: 'mock',
  AI_DEFAULT_ENABLED: false,
  AI_PROMPT_VERSION: 'auditflow-evidence-analysis-v1',
  AI_MODEL_NAME: 'auditflow-mock-v1',
  AI_MAX_INPUT_CHARS: 12000,
  REDIS_URL: 'redis://localhost:6379',
  JOBS_ENABLED: false,
  JOB_WORKER_CONCURRENCY: 3,
  JOB_REMOVE_ON_COMPLETE_COUNT: 1000,
  JOB_REMOVE_ON_FAIL_COUNT: 1000,
  NOTIFICATION_EMAIL_PROVIDER: 'fake',
  NOTIFICATION_DEFAULT_CHANNEL: 'EMAIL',
  EXPIRING_EVIDENCE_THRESHOLD_DAYS: 30,
  TASK_DUE_SOON_DAYS: 3,
  APP_VERSION: '0.1.0',
  RELEASE_ID: 'test',
  COMMIT_SHA: 'test',
  READINESS_CHECK_DATABASE: true,
  READINESS_CHECK_REDIS: false,
  BACKUP_POLICY_NAME: 'test',
  RESTORE_TEST_REQUIRED_BEFORE_CUSTOMER_DATA: true,
  CUSTOMER_EVIDENCE_ENABLED: false,
  PRODUCTION_GATE_STATUS: 'BLOCKED',
  PRODUCTION_GATE_APPROVAL_REFERENCE: undefined,
};

describe('production customer evidence gate', () => {
  it('does not block local or staging evidence workflows', () => {
    expect(() => assertProductionCustomerEvidenceGateOpen({ ...baseEnv, NODE_ENV: 'staging' })).not.toThrow();
    expect(() => assertProductionCustomerEvidenceGateOpen({ ...baseEnv, NODE_ENV: 'development' })).not.toThrow();
  });

  it('blocks production customer evidence when gate is not enabled and approved', () => {
    expect(() => assertProductionCustomerEvidenceGateOpen(baseEnv)).toThrow(/production non-functional gate/i);
  });

  it('requires malware scanning in production even when the gate is approved', () => {
    expect(() =>
      assertProductionCustomerEvidenceGateOpen({
        ...baseEnv,
        CUSTOMER_EVIDENCE_ENABLED: true,
        PRODUCTION_GATE_STATUS: 'APPROVED',
        PRODUCTION_GATE_APPROVAL_REFERENCE: 'GO-LIVE-001',
        SECURITY_SCAN_MODE: 'disabled_non_production',
        SECURITY_SCAN_ALLOW_NON_PRODUCTION_BYPASS: false,
      }),
    ).toThrow(/SECURITY_SCAN_MODE=required/);
  });

  it('requires a signed approval reference before customer evidence can be enabled', () => {
    expect(() =>
      assertProductionCustomerEvidenceGateOpen({
        ...baseEnv,
        CUSTOMER_EVIDENCE_ENABLED: true,
        PRODUCTION_GATE_STATUS: 'APPROVED',
        PRODUCTION_GATE_APPROVAL_REFERENCE: '   ',
      }),
    ).toThrow(/approval reference/i);
  });

  it('allows production customer evidence only after the gate is explicitly approved', () => {
    expect(() =>
      assertProductionCustomerEvidenceGateOpen({
        ...baseEnv,
        CUSTOMER_EVIDENCE_ENABLED: true,
        PRODUCTION_GATE_STATUS: 'APPROVED',
        PRODUCTION_GATE_APPROVAL_REFERENCE: 'GO-LIVE-001',
      }),
    ).not.toThrow();
  });
});
