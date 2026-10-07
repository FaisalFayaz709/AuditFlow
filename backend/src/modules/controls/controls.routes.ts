import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import { sendData } from '../../shared/response.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { CompanyControlStateBodySchema, ControlIdParamsSchema, ControlsQuerySchema } from './control.schemas.js';
import { ControlsService } from './controls.service.js';
import { DashboardService } from '../dashboard/dashboard.service.js';

function getIp(request: FastifyRequest): string | undefined {
  return request.ip;
}

function getUserAgent(request: FastifyRequest): string | undefined {
  const value = request.headers['user-agent'];
  return Array.isArray(value) ? value[0] : value;
}

async function resolveTenantFromHeader(request: FastifyRequest) {
  const actor = requireAuthenticatedUser(request);
  const companyIdHeader = request.headers['x-auditflow-company-id'];
  const companyId = Array.isArray(companyIdHeader) ? companyIdHeader[0] : companyIdHeader;
  if (!companyId) {
    return null;
  }
  return requireCompanyMembership({
    lookup: new PrismaCompanyMembershipLookup(request.server.prisma),
    userId: actor.userId,
    companyId,
  });
}

export const controlsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/controls', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) {
      return reply.status(400).send({
        error: {
          code: 'ACTIVE_COMPANY_REQUIRED',
          message: 'Send x-auditflow-company-id to select a company context.',
          requestId: request.requestContext.requestId,
          details: [{ field: 'x-auditflow-company-id', reason: 'required' }],
        },
      });
    }

    const query = ControlsQuerySchema.parse(request.query ?? {});
    return sendData(request, reply, { items: await new ControlsService(app.prisma).listControls(tenant, query) });
  });


  app.get('/api/controls/:id/readiness-explanation', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) {
      return reply.status(400).send({
        error: {
          code: 'ACTIVE_COMPANY_REQUIRED',
          message: 'Send x-auditflow-company-id to select a company context.',
          requestId: request.requestContext.requestId,
          details: [{ field: 'x-auditflow-company-id', reason: 'required' }],
        },
      });
    }

    const params = ControlIdParamsSchema.parse(request.params);
    return sendData(request, reply, await new DashboardService(app.prisma).getControlReadinessExplanation({ tenant, companyControlId: params.id }));
  });

  app.get('/api/controls/:id', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) {
      return reply.status(400).send({
        error: {
          code: 'ACTIVE_COMPANY_REQUIRED',
          message: 'Send x-auditflow-company-id to select a company context.',
          requestId: request.requestContext.requestId,
          details: [{ field: 'x-auditflow-company-id', reason: 'required' }],
        },
      });
    }

    const params = ControlIdParamsSchema.parse(request.params);
    return sendData(request, reply, await new ControlsService(app.prisma).getControlDetail(tenant, params.id));
  });

  app.patch('/api/controls/:id/company-state', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) {
      return reply.status(400).send({
        error: {
          code: 'ACTIVE_COMPANY_REQUIRED',
          message: 'Send x-auditflow-company-id to select a company context.',
          requestId: request.requestContext.requestId,
          details: [{ field: 'x-auditflow-company-id', reason: 'required' }],
        },
      });
    }

    const params = ControlIdParamsSchema.parse(request.params);
    const body = CompanyControlStateBodySchema.parse(request.body ?? {});
    const actor = requireAuthenticatedUser(request);
    const data = await new ControlsService(app.prisma).updateCompanyControlState({
      tenant,
      companyControlId: params.id,
      body,
      requestId: request.requestContext.requestId,
      sessionId: actor.sessionId,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
    });

    return sendData(request, reply, data);
  });
};
