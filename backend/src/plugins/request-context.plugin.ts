import { randomUUID } from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

export const requestContextPlugin: FastifyPluginAsync = fp(async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    const inboundRequestId = request.headers['x-request-id'];
    const requestId = Array.isArray(inboundRequestId)
      ? inboundRequestId[0]
      : inboundRequestId || randomUUID();

    request.requestContext = { requestId };
    reply.header('x-request-id', requestId);
  });
});
