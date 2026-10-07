import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';
import { isAppError } from '../shared/errors.js';

export const errorHandlerPlugin: FastifyPluginAsync = fp(async (app) => {
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.requestContext?.requestId ?? 'unknown';

    if (isAppError(error)) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId,
          details: error.details,
        },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request payload is invalid.',
          requestId,
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            reason: issue.message,
          })),
        },
      });
    }

    request.log.error({ err: error, requestId }, 'Unhandled request error');

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected server error occurred.',
        requestId,
        details: [],
      },
    });
  });
});
