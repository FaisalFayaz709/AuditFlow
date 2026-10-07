import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('health and readiness routes', async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://example:example@localhost:5432/example';
  process.env.READINESS_CHECK_DATABASE = 'false';
  process.env.READINESS_CHECK_REDIS = 'false';
  process.env.APP_VERSION = 'test-version';
  process.env.RELEASE_ID = 'test-release';
  process.env.COMMIT_SHA = 'test-commit';

  const { app } = await buildApp();

  afterAll(async () => {
    await app.close();
  });

  it('returns process liveness without dependency checks', async () => {
    const response = await app.inject({ method: 'GET', url: '/health', headers: { 'x-request-id': 'health-test-request' } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        status: 'ok',
        service: 'auditflow-backend',
        version: 'test-version',
        releaseId: 'test-release',
        commitSha: 'test-commit',
      },
      meta: {
        requestId: 'health-test-request',
      },
    });
  });

  it('returns readiness metadata with skipped checks when explicitly disabled', async () => {
    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        status: 'ready',
        dependencies: {
          database: { status: 'skipped' },
          redis: { status: 'skipped' },
        },
      },
    });
  });
});
