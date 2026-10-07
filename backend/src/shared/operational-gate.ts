import type { AppEnv } from '../config/env.js';

const DEVELOPMENT_SESSION_PEPPER = 'development_session_pepper_change_before_staging';
const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i;

type OperationalEnvironment = 'staging' | 'production';

function isOperationalEnvironment(env: AppEnv): env is AppEnv & { NODE_ENV: OperationalEnvironment } {
  return env.NODE_ENV === 'staging' || env.NODE_ENV === 'production';
}

function isLocalFrontendOrigin(origin: string): boolean {
  return origin === '*' || LOCAL_ORIGIN_PATTERN.test(origin);
}

export function collectOperationalGateFailures(env: AppEnv): string[] {
  const failures: string[] = [];
  if (!isOperationalEnvironment(env)) return failures;

  if (isLocalFrontendOrigin(env.FRONTEND_ORIGIN)) {
    failures.push('FRONTEND_ORIGIN must be an explicit deployed HTTPS origin in staging/production; wildcard or localhost origins are not allowed.');
  }

  if (!env.FRONTEND_ORIGIN.startsWith('https://')) {
    failures.push('FRONTEND_ORIGIN must use HTTPS in staging/production.');
  }

  if (!env.SESSION_PEPPER || env.SESSION_PEPPER === DEVELOPMENT_SESSION_PEPPER || env.SESSION_PEPPER.length < 32) {
    failures.push('SESSION_PEPPER must be a non-default secret with at least 32 characters in staging/production.');
  }

  if (env.STORAGE_DRIVER === 'local') {
    failures.push('Private production-like object storage must use s3, r2, or minio; local storage is local/test only.');
  }

  if (env.SECURITY_SCAN_MODE !== 'required' || env.SECURITY_SCAN_PROVIDER === 'fake') {
    failures.push('Malware/security scanning must be required and must use a real scanner in staging/production.');
  }

  if (!env.READINESS_CHECK_DATABASE) {
    failures.push('READINESS_CHECK_DATABASE must remain enabled in staging/production.');
  }

  if (!env.DATABASE_SSL_REQUIRED) {
    failures.push('DATABASE_SSL_REQUIRED must be true in staging/production.');
  }

  if (env.NODE_ENV === 'production' && !env.DATABASE_PITR_ENABLED) {
    failures.push('DATABASE_PITR_ENABLED must be true before production release.');
  }

  if (env.SECRET_MANAGER_PROVIDER === 'local') {
    failures.push('SECRET_MANAGER_PROVIDER must reference a platform or managed secret store in staging/production.');
  }

  if (env.STRUCTURED_LOG_FORMAT !== 'json') {
    failures.push('STRUCTURED_LOG_FORMAT must be json for redacted structured logs.');
  }

  if (['debug', 'trace'].includes(env.LOG_LEVEL)) {
    failures.push('LOG_LEVEL must not be debug or trace in staging/production.');
  }

  if (env.RELEASE_ID === 'local-dev' || env.COMMIT_SHA === 'local') {
    failures.push('RELEASE_ID and COMMIT_SHA must be deployment-specific values in staging/production.');
  }

  if (env.NODE_ENV === 'production' && env.BACKUP_POLICY_NAME === 'portfolio-mvp-best-effort') {
    failures.push('BACKUP_POLICY_NAME must name the approved production backup/PITR policy.');
  }

  if (env.NODE_ENV === 'production' && env.RESTORE_TEST_REQUIRED_BEFORE_CUSTOMER_DATA && env.LAST_RESTORE_TEST_STATUS !== 'PASSED') {
    failures.push('LAST_RESTORE_TEST_STATUS must be PASSED before production customer-evidence release.');
  }

  return failures;
}

export function assertOperationalBootGate(env: AppEnv): void {
  const failures = collectOperationalGateFailures(env);
  if (failures.length > 0) {
    throw new Error(`Invalid operational boot gate: ${failures.join(' | ')}`);
  }
}
