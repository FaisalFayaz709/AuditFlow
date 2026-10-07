import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import { sendData } from '../../shared/response.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { DashboardQuerySchema } from './dashboard.schemas.js';
import { DashboardService } from './dashboard.service.js';

async function resolveTenantFromHeader(request: FastifyRequest) {
  const actor = requireAuthenticatedUser(request);
  const companyIdHeader = request.headers['x-auditflow-company-id'];
  const companyId = Array.isArray(companyIdHeader) ? companyIdHeader[0] : companyIdHeader;
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

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/dashboard/overview', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = DashboardQuerySchema.parse(request.query ?? {});
    const data = await new DashboardService(app.prisma).getOverview({ tenant, query });
    return sendData(request, reply, data);
  });


  app.get('/api/dashboard/readiness-trace', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = DashboardQuerySchema.parse(request.query ?? {});
    const data = await new DashboardService(app.prisma).getReadinessTrace({ tenant, query });
    return sendData(request, reply, data);
  });

  app.get('/api/dashboard/control-progress', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = DashboardQuerySchema.parse(request.query ?? {});
    const data = await new DashboardService(app.prisma).getControlProgress({ tenant, query });
    return sendData(request, reply, data);
  });

  app.get('/api/dashboard/missing-evidence', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = DashboardQuerySchema.parse(request.query ?? {});
    const data = await new DashboardService(app.prisma).getMissingEvidence({ tenant, query });
    return sendData(request, reply, data);
  });

  app.get('/api/dashboard/overdue-tasks', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const data = await new DashboardService(app.prisma).getOverdueTasks({ tenant });
    return sendData(request, reply, data);
  });

  app.get('/api/dashboard/expiring-evidence', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = DashboardQuerySchema.parse(request.query ?? {});
    const data = await new DashboardService(app.prisma).getExpiringEvidence({ tenant, query });
    return sendData(request, reply, data);
  });
};
