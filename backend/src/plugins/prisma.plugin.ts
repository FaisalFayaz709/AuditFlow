import { PrismaClient } from '@prisma/client';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

export const prismaPlugin: FastifyPluginAsync = fp(async (app) => {
  const prisma = new PrismaClient({
    log: app.log.level === 'debug' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

  app.decorate('prisma', prisma);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
