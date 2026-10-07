import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { AppEnv } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { clearSessionCookie, setSessionCookie } from '../../shared/http-cookies.js';
import { sendData } from '../../shared/response.js';
import { requireAuthenticatedUser } from '../../shared/tenant-boundary.js';
import { normalizeEmail } from '../../shared/crypto.js';
import { AuthService } from './auth.service.js';
import {
  ChangePasswordBodySchema,
  ForgotPasswordBodySchema,
  LoginBodySchema,
  RegisterBodySchema,
  ResetPasswordBodySchema,
  VerifyEmailBodySchema,
} from './auth.schemas.js';
import { InMemoryRateLimitService } from './rate-limit.service.js';

function getIp(request: FastifyRequest): string | undefined {
  return request.ip;
}

function getUserAgent(request: FastifyRequest): string | undefined {
  const value = request.headers['user-agent'];
  return Array.isArray(value) ? value[0] : value;
}

export const authRoutes: FastifyPluginAsync<{ env: AppEnv }> = async (app, { env }) => {
  const rateLimit = new InMemoryRateLimitService({ windowMs: 15 * 60 * 1000, max: 10 });

  app.post('/api/auth/register', async (request, reply) => {
    const body = RegisterBodySchema.parse(request.body);
    rateLimit.assertAllowed(`register:${getIp(request) ?? 'unknown'}:${normalizeEmail(body.email)}`);

    const service = new AuthService(app.prisma, env);
    const result = await service.register({
      ...body,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
      requestId: request.requestContext.requestId,
    });

    setSessionCookie(reply, result.rawSessionToken, env);
    const { rawSessionToken: _raw, emailVerificationToken, ...data } = result;
    return reply.status(201).send({
      data: {
        ...data,
        devEmailVerificationToken: env.NODE_ENV === 'production' ? undefined : emailVerificationToken,
      },
      meta: { requestId: request.requestContext.requestId },
    });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = LoginBodySchema.parse(request.body);
    rateLimit.assertAllowed(`login:${getIp(request) ?? 'unknown'}:${normalizeEmail(body.email)}`);

    const service = new AuthService(app.prisma, env);
    const result = await service.login({
      ...body,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
      requestId: request.requestContext.requestId,
    });

    setSessionCookie(reply, result.rawSessionToken, env);
    const { rawSessionToken: _raw, ...data } = result;
    return sendData(request, reply, data);
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const actor = requireAuthenticatedUser(request);
    if (!actor.sessionId) {
      throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'A valid session is required.' });
    }

    const service = new AuthService(app.prisma, env);
    await service.logout({ sessionId: actor.sessionId });
    clearSessionCookie(reply, env);
    return reply.status(204).send();
  });

  app.get('/api/auth/me', async (request, reply) => {
    const actor = requireAuthenticatedUser(request);
    if (!actor.sessionId) {
      throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'A valid session is required.' });
    }

    const service = new AuthService(app.prisma, env);
    return sendData(request, reply, await service.me(actor.userId, actor.sessionId));
  });

  app.get('/api/auth/csrf', async (request, reply) => {
    const actor = requireAuthenticatedUser(request);
    if (!actor.sessionId) {
      throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'A valid session is required.' });
    }

    const service = new AuthService(app.prisma, env);
    return sendData(request, reply, { csrfToken: await service.issueCsrfToken(actor.sessionId) });
  });

  app.post('/api/auth/forgot-password', async (request, reply) => {
    const body = ForgotPasswordBodySchema.parse(request.body);
    rateLimit.assertAllowed(`forgot-password:${getIp(request) ?? 'unknown'}:${normalizeEmail(body.email)}`);

    const service = new AuthService(app.prisma, env);
    const result = await service.forgotPassword(body.email);
    return sendData(request, reply, {
      message: 'If the email exists, reset instructions will be sent.',
      ...result,
    });
  });

  app.post('/api/auth/reset-password', async (request, reply) => {
    const body = ResetPasswordBodySchema.parse(request.body);
    rateLimit.assertAllowed(`reset-password:${getIp(request) ?? 'unknown'}`);

    const service = new AuthService(app.prisma, env);
    await service.resetPassword(body);
    clearSessionCookie(reply, env);
    return reply.status(204).send();
  });

  app.post('/api/auth/verify-email', async (request, reply) => {
    const body = VerifyEmailBodySchema.parse(request.body);
    const service = new AuthService(app.prisma, env);
    await service.verifyEmail(body);
    return reply.status(204).send();
  });

  app.post('/api/auth/change-password', async (request, reply) => {
    const actor = requireAuthenticatedUser(request);
    const body = ChangePasswordBodySchema.parse(request.body);
    const service = new AuthService(app.prisma, env);
    await service.changePassword({ userId: actor.userId, ...body });
    clearSessionCookie(reply, env);
    return reply.status(204).send();
  });
};
