import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { AppEnv } from '../../config/env.js';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { sendData } from '../../shared/response.js';
import { JobsService } from './jobs.service.js';
import { RunMaintenanceJobBodySchema } from './jobs.schemas.js';

function getHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function resolveTenantFromHeader(request: FastifyRequest) {
  const actor = requireAuthenticatedUser(request);
  const companyId = getHeader(request, 'x-auditflow-company-id');
  if (!companyId) return null;
  return requireCompanyMembership({
    lookup: new PrismaCompanyMembershipLookup(request.server.prisma),
    userId: actor.userId,
    companyId,
  });
}

function activeCompanyRequired(request: FastifyRequest) {
  return {
    error: {
      code: 'ACTIVE_COMPANY_REQUIRED',
      message: 'Send x-auditflow-company-id to select a company context.',
      requestId: request.requestContext.requestId,
      details: [{ field: 'x-auditflow-company-id', reason: 'required' }],
    },
  };
}

function auditContext(request: FastifyRequest) {
  const actor = requireAuthenticatedUser(request);
  const userAgent = request.headers['user-agent'];
  return {
    requestId: request.requestContext.requestId,
    sessionId: actor.sessionId,
    ipAddress: request.ip,
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
  };
}

export const jobsRoutes: FastifyPluginAsync<{ env: AppEnv }> = async (app, { env }) => {
  app.get('/api/jobs/status', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const data = await new JobsService(app.prisma, env).getQueueStatus(tenant);
    return sendData(request, reply, data);
  });

  app.post('/api/jobs/maintenance/run', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const body = RunMaintenanceJobBodySchema.parse(request.body ?? {});
    const data = await new JobsService(app.prisma, env).runMaintenanceNow({ tenant, type: body.type, audit: auditContext(request) });
    return sendData(request, reply, data);
  });
};
