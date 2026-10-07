import helmet from '@fastify/helmet';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

export const securityHeadersPlugin: FastifyPluginAsync = fp(async (app) => {
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });
});
