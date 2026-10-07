import multipart from '@fastify/multipart';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { AppEnv } from '../config/env.js';

export const multipartPlugin: FastifyPluginAsync<{ env: AppEnv }> = fp(async (app, { env }) => {
  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_UPLOAD_BYTES,
      files: 1,
      fields: 10,
    },
  });
});
