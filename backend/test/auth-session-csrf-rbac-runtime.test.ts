import type { FastifyReply } from 'fastify';
import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import type { AppEnv } from '../src/config/env.js';
import {
  clearSessionCookie,
  getSessionCookieAttributes,
  SESSION_COOKIE_DEFAULT_SAMESITE,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from '../src/shared/http-cookies.js';
import { requiresCsrfToken } from '../src/plugins/csrf.plugin.js';
import { assertActiveMembership, type CompanyMembershipRecord, type TenantContext } from '../src/shared/tenant-context.js';
import { hasPermission, requirePermission } from '../src/modules/authz/permissions.js';
import { authorizationPredicates } from '../src/modules/authz/predicates.js';
import { SessionService } from '../src/modules/auth/session.service.js';

function env(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    NODE_ENV: 'development',
    PORT: 4000,
    HOST: '127.0.0.1',
    DATABASE_URL: 'postgresql://auditflow:auditflow_dev_password@localhost:5432/auditflow_test',
    FRONTEND_ORIGIN: 'http://localhost:5173',
    LOG_LEVEL: 'silent',
    STRUCTURED_LOG_FORMAT: 'json',
    DATABASE_SSL_REQUIRED: false,
    DATABASE_PITR_ENABLED: false,
    SECRET_MANAGER_PROVIDER: 'local',
    LAST_RESTORE_TEST_STATUS: 'NOT_RUN',
    SESSION_PEPPER: 'development_session_pepper_change_before_staging',
    SESSION_IDLE_SECONDS: 60 * 60 * 12,
    SESSION_ABSOLUTE_SECONDS: 60 * 60 * 24 * 7,
    CSRF_TOKEN_SECONDS: 60 * 60 * 12,
    PASSWORD_RESET_TOKEN_SECONDS: 60 * 30,
    EMAIL_VERIFICATION_TOKEN_SECONDS: 60 * 60 * 24,
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_ROOT: './.auditflow-storage',
    STORAGE_BUCKET: undefined,
    STORAGE_REGION: 'auto',
    STORAGE_ENDPOINT: undefined,
    STORAGE_ACCESS_KEY_ID: undefined,
    STORAGE_SECRET_ACCESS_KEY: undefined,
    STORAGE_FORCE_PATH_STYLE: false,
    STORAGE_SIGNED_URL_TTL_SECONDS: 300,
    STORAGE_SERVER_SIDE_ENCRYPTION: undefined,
    STORAGE_KMS_KEY_ID: undefined,
    MAX_UPLOAD_BYTES: 25 * 1024 * 1024,
    SECURITY_SCAN_MODE: 'disabled_non_production',
    SECURITY_SCAN_PROVIDER: 'fake',
    SECURITY_SCAN_ALLOW_NON_PRODUCTION_BYPASS: true,
    CLAMAV_HOST: '127.0.0.1',
    CLAMAV_PORT: 3310,
    CLAMAV_TIMEOUT_MS: 10_000,
    UPLOAD_INTENT_TTL_SECONDS: 60 * 60,
    AI_PROVIDER: 'mock',
    AI_DEFAULT_ENABLED: false,
    AI_PROMPT_VERSION: 'auditflow-evidence-analysis-v1',
    AI_MODEL_NAME: 'auditflow-mock-v1',
    AI_MAX_INPUT_CHARS: 12_000,
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
    RELEASE_ID: 'local-dev',
    COMMIT_SHA: 'local',
    READINESS_CHECK_DATABASE: true,
    READINESS_CHECK_REDIS: false,
    OBSERVABILITY_ERROR_TRACKING_DSN: undefined,
    OBSERVABILITY_UPTIME_CHECK_URL: undefined,
    BACKUP_POLICY_NAME: 'portfolio-mvp-best-effort',
    RESTORE_TEST_REQUIRED_BEFORE_CUSTOMER_DATA: true,
    CUSTOMER_EVIDENCE_ENABLED: false,
    PRODUCTION_GATE_STATUS: 'BLOCKED',
    PRODUCTION_GATE_APPROVAL_REFERENCE: undefined,
    ...overrides,
  };
}

function captureReply(): { reply: FastifyReply; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const reply = {
    header(name: string, value: string) {
      headers[name] = value;
      return this;
    },
  } as unknown as FastifyReply;
  return { reply, headers };
}

function tenant(role: TenantContext['role']): TenantContext {
  return {
    companyId: 'company_a',
    userId: 'user_a',
    membershipId: 'membership_a',
    role,
  };
}

function membership(status: CompanyMembershipRecord['status']): CompanyMembershipRecord {
  return {
    membershipId: 'membership_a',
    companyId: 'company_a',
    userId: 'user_a',
    role: 'OWNER',
    status,
  };
}

describe('Pass 45 auth/session/CSRF/RBAC runtime contract', () => {
  it('keeps browser auth as an opaque HttpOnly auditflow_session cookie with v2.1 defaults', () => {
    const attributes = getSessionCookieAttributes(env({ SESSION_ABSOLUTE_SECONDS: 12345 }));
    expect(attributes).toMatchObject({
      name: SESSION_COOKIE_NAME,
      httpOnly: true,
      secure: false,
      sameSite: SESSION_COOKIE_DEFAULT_SAMESITE,
      path: '/',
      maxAge: 12345,
    });

    const { reply, headers } = captureReply();
    setSessionCookie(reply, 'opaque-token-value', env({ SESSION_ABSOLUTE_SECONDS: 12345 }));
    expect(headers['Set-Cookie']).toContain(`${SESSION_COOKIE_NAME}=opaque-token-value`);
    expect(headers['Set-Cookie']).toContain('HttpOnly');
    expect(headers['Set-Cookie']).toContain('Path=/');
    expect(headers['Set-Cookie']).toContain('SameSite=Lax');
    expect(headers['Set-Cookie']).toContain('Max-Age=12345');
    expect(headers['Set-Cookie']).not.toContain('Secure');
  });

  it('adds Secure to session cookies in staging/production and clears by expiring the same cookie', () => {
    const stagingEnv = env({ NODE_ENV: 'staging', SESSION_ABSOLUTE_SECONDS: 777 });
    const { reply, headers } = captureReply();

    setSessionCookie(reply, 'opaque-token-value', stagingEnv);
    expect(headers['Set-Cookie']).toContain('Secure');
    expect(headers['Set-Cookie']).toContain('Max-Age=777');

    clearSessionCookie(reply, stagingEnv);
    expect(headers['Set-Cookie']).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(headers['Set-Cookie']).toContain('HttpOnly');
    expect(headers['Set-Cookie']).toContain('Path=/');
    expect(headers['Set-Cookie']).toContain('SameSite=Lax');
    expect(headers['Set-Cookie']).toContain('Max-Age=0');
    expect(headers['Set-Cookie']).toContain('Secure');
  });

  it('requires CSRF only for authenticated state-changing non-public routes', () => {
    expect(requiresCsrfToken({ method: 'GET', path: '/api/evidence', hasAuthenticatedSession: true })).toBe(false);
    expect(requiresCsrfToken({ method: 'POST', path: '/api/auth/login', hasAuthenticatedSession: false })).toBe(false);
    expect(requiresCsrfToken({ method: 'POST', path: '/api/auth/reset-password', hasAuthenticatedSession: false })).toBe(false);
    expect(requiresCsrfToken({ method: 'POST', path: '/api/evidence/upload', hasAuthenticatedSession: false })).toBe(false);
    expect(requiresCsrfToken({ method: 'POST', path: '/api/evidence/upload', hasAuthenticatedSession: true })).toBe(true);
    expect(requiresCsrfToken({ method: 'DELETE', path: '/api/comments/comment_a', hasAuthenticatedSession: true })).toBe(true);
  });

  it('derives company scope from active membership and rejects disabled/removed memberships', () => {
    expect(assertActiveMembership(membership('ACTIVE'))).toEqual({
      companyId: 'company_a',
      userId: 'user_a',
      membershipId: 'membership_a',
      role: 'OWNER',
    });
    expect(() => assertActiveMembership(null)).toThrowError(AppError);
    expect(() => assertActiveMembership(membership('DISABLED'))).toThrowError(AppError);
    expect(() => assertActiveMembership(membership('REMOVED'))).toThrowError(AppError);
  });

  it('keeps backend RBAC authoritative for evidence/mapping/task/auditor boundaries', () => {
    expect(hasPermission('OWNER', 'evidence.review')).toBe(true);
    expect(hasPermission('ADMIN', 'mapping.review')).toBe(true);
    expect(hasPermission('COMPLIANCE_MANAGER', 'tasks.review')).toBe(true);
    expect(hasPermission('MEMBER', 'evidence.review')).toBe(false);
    expect(hasPermission('MEMBER', 'mapping.review')).toBe(false);
    expect(hasPermission('AUDITOR', 'evidence.upload')).toBe(false);
    expect(hasPermission('AUDITOR', 'reports.generate')).toBe(false);
    expect(() => requirePermission(tenant('MEMBER'), 'evidence.review')).toThrowError(AppError);
    expect(() => requirePermission(tenant('AUDITOR'), 'tasks.manage')).toThrowError(AppError);
  });

  it('keeps exact authorization predicates named for tenant and role enforcement', () => {
    expect(authorizationPredicates['tenant.active_membership']).toContain('Active tenant membership');
    expect(authorizationPredicates['tenant.scoped_entity_lookup']).toContain('foreign IDs behave as not found');
    expect(authorizationPredicates['evidence.review']).toContain('OWNER, ADMIN, or COMPLIANCE_MANAGER');
    expect(authorizationPredicates['mapping.review']).toContain('OWNER, ADMIN, or COMPLIANCE_MANAGER');
    expect(authorizationPredicates['auditor.active_scope_grant']).toContain('active, unrevoked, unexpired grant');
  });

  it('treats revoked, idle-expired, and absolute-expired server-side sessions as inactive', () => {
    const now = new Date('2026-08-09T08:00:00.000Z');
    expect(SessionService.isActive({
      revoked_at: null,
      idle_expires_at: new Date('2026-08-09T09:00:00.000Z'),
      absolute_expires_at: new Date('2026-08-16T08:00:00.000Z'),
    }, now)).toBe(true);
    expect(SessionService.isActive({
      revoked_at: new Date('2026-08-09T07:00:00.000Z'),
      idle_expires_at: new Date('2026-08-09T09:00:00.000Z'),
      absolute_expires_at: new Date('2026-08-16T08:00:00.000Z'),
    }, now)).toBe(false);
    expect(SessionService.isActive({
      revoked_at: null,
      idle_expires_at: new Date('2026-08-09T07:59:59.000Z'),
      absolute_expires_at: new Date('2026-08-16T08:00:00.000Z'),
    }, now)).toBe(false);
    expect(SessionService.isActive({
      revoked_at: null,
      idle_expires_at: new Date('2026-08-09T09:00:00.000Z'),
      absolute_expires_at: new Date('2026-08-09T07:59:59.000Z'),
    }, now)).toBe(false);
  });
});
