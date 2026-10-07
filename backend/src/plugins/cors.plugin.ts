import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { AppEnv } from '../config/env.js';

type CorsPluginOptions = {
  env: AppEnv;
};

export const corsPlugin: FastifyPluginAsync<CorsPluginOptions> = fp(async (app, opts) => {
  await app.register(cors, {
    origin: opts.env.FRONTEND_ORIGIN,
    credentials: true,
  });
});
