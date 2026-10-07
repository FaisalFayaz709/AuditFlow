import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://example:example@localhost:5432/example';
process.env.READINESS_CHECK_DATABASE = 'false';
process.env.READINESS_CHECK_REDIS = 'false';
process.env.APP_VERSION = 'pass44-test-version';
process.env.RELEASE_ID = 'pass44-test-release';
process.env.COMMIT_SHA = 'pass44-test-commit';
process.env.LOG_LEVEL = 'silent';
process.env.CUSTOMER_EVIDENCE_ENABLED = 'false';
process.env.PRODUCTION_GATE_STATUS = 'BLOCKED';

describe('Pass 44 backend boot and health contract', async () => {
  const { app } = await buildApp();

  afterAll(async () => {
    await app.close();
  });

  it('boots the Fastify modular monolith with the mandatory health routes registered', () => {
    expect(app.hasRoute({ method: 'GET', url: '/health' })).toBe(true);
    expect(app.hasRoute({ method: 'GET', url: '/ready' })).toBe(true);
    expect(app.hasRoute({ method: 'GET', url: '/api/auth/me' })).toBe(true);
    expect(app.hasRoute({ method: 'GET', url: '/api/dashboard/overview' })).toBe(true);
    expect(app.hasRoute({ method: 'GET', url: '/api/audit-logs' })).toBe(true);
  });

  it('returns /health liveness with the request-context request ID in header and envelope metadata', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'pass44-health-request' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('pass44-health-request');
    expect(response.json()).toMatchObject({
      data: {
        status: 'ok',
        service: 'auditflow-backend',
        version: 'pass44-test-version',
        releaseId: 'pass44-test-release',
        commitSha: 'pass44-test-commit',
      },
      meta: {
        requestId: 'pass44-health-request',
      },
    });
  });

  it('returns /ready dependency readiness without attempting skipped database or redis checks', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ready',
      headers: { 'x-request-id': 'pass44-ready-request' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('pass44-ready-request');
    expect(response.json()).toMatchObject({
      data: {
        status: 'ready',
        service: 'auditflow-backend',
        dependencies: {
          database: { status: 'skipped', message: 'READINESS_CHECK_DATABASE=false' },
          redis: { status: 'skipped', message: 'READINESS_CHECK_REDIS=false' },
        },
      },
      meta: {
        requestId: 'pass44-ready-request',
      },
    });
  });

  it('returns standardized error envelopes with request IDs from protected unauthenticated routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { 'x-request-id': 'pass44-error-request' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['x-request-id']).toBe('pass44-error-request');
    expect(response.json()).toMatchObject({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required for this operation.',
        requestId: 'pass44-error-request',
        details: [],
      },
    });
  });
});
