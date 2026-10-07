import type { FastifyPluginAsync } from 'fastify';
import type { AppEnv } from '../../config/env.js';

type HealthOptions = {
  env: AppEnv;
};

type DependencyCheck = {
  status: 'ok' | 'skipped' | 'failed';
  message?: string;
};

function safeFailure(error: unknown): string {
  if (error instanceof Error) return error.name || 'DependencyCheckFailed';
  return 'DependencyCheckFailed';
}

export const healthRoutes: FastifyPluginAsync<HealthOptions> = async (app, options) => {
  const { env } = options;

  app.get('/health', async (request) => ({
    data: {
      status: 'ok',
      service: 'auditflow-backend',
      version: env.APP_VERSION,
      releaseId: env.RELEASE_ID,
      commitSha: env.COMMIT_SHA,
    },
    meta: {
      requestId: request.requestContext?.requestId ?? 'health-check',
    },
  }));

  app.get('/ready', async (_request, reply) => {
    const database: DependencyCheck = env.READINESS_CHECK_DATABASE
      ? { status: 'ok' }
      : { status: 'skipped', message: 'READINESS_CHECK_DATABASE=false' };

    if (env.READINESS_CHECK_DATABASE) {
      try {
        await app.prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        database.status = 'failed';
        database.message = safeFailure(error);
      }
    }

    const redis: DependencyCheck = env.READINESS_CHECK_REDIS
      ? { status: env.JOBS_ENABLED ? 'ok' : 'skipped', message: 'JOBS_ENABLED=false' }
      : { status: 'skipped', message: 'READINESS_CHECK_REDIS=false' };

    const ready = database.status !== 'failed' && redis.status !== 'failed';
    if (!ready) reply.code(503);

    return {
      data: {
        status: ready ? 'ready' : 'not_ready',
        service: 'auditflow-backend',
        version: env.APP_VERSION,
        releaseId: env.RELEASE_ID,
        commitSha: env.COMMIT_SHA,
        dependencies: {
          database,
          redis,
        },
      },
      meta: {
        requestId: _request.requestContext?.requestId ?? 'ready-check',
        checkedAt: new Date().toISOString(),
      },
    };
  });
};
