import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { AppEnv } from '../config/env.js';
import { SessionService } from '../modules/auth/session.service.js';

export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const PUBLIC_AUTH_PATHS = new Set([
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
]);

export function requiresCsrfToken(params: {
  method: string;
  path: string;
  hasAuthenticatedSession: boolean;
}): boolean {
  if (SAFE_METHODS.has(params.method.toUpperCase())) return false;
  if (PUBLIC_AUTH_PATHS.has(params.path)) return false;
  return params.hasAuthenticatedSession;
}

export const csrfPlugin: FastifyPluginAsync<{ env: AppEnv }> = fp(async (app, { env }) => {
  const sessions = new SessionService(app.prisma, env);

  app.addHook('preHandler', async (request) => {
    const actor = request.requestContext.actor;
    const path = request.url.split('?')[0];
    if (!requiresCsrfToken({
      method: request.method,
      path,
      hasAuthenticatedSession: Boolean(actor?.sessionId),
    })) return;

    const header = request.headers['x-csrf-token'];
    const csrfToken = Array.isArray(header) ? header[0] : header;
    await sessions.validateCsrfToken(actor?.sessionId ?? '', csrfToken);
  });
});
