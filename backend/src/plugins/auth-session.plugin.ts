import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { AppEnv } from '../config/env.js';
import { getSessionCookie } from '../shared/http-cookies.js';
import { SessionService } from '../modules/auth/session.service.js';

export const authSessionPlugin: FastifyPluginAsync<{ env: AppEnv }> = fp(async (app, { env }) => {
  const sessions = new SessionService(app.prisma, env);

  app.addHook('onRequest', async (request) => {
    const token = getSessionCookie(request);
    const resolved = await sessions.resolveSession(token);

    if (resolved) {
      request.requestContext.actor = {
        userId: resolved.userId,
        sessionId: resolved.sessionId,
      };
    }
  });
});
