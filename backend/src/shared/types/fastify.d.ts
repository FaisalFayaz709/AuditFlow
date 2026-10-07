import 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedActor, TenantContext } from '../tenant-context.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    requestContext: {
      requestId: string;
      actor?: AuthenticatedActor;
      tenant?: TenantContext;
    };
  }
}
