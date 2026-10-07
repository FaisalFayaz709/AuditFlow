import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import { sendData } from '../../shared/response.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { AuditorAccessListQuerySchema, AuditorGrantIdParamsSchema, AuditorViewListQuerySchema, CreateAuditorAccessGrantBodySchema } from './auditor-access.schemas.js';
import { AuditorAccessService } from './auditor-access.service.js';

function getIp(request: FastifyRequest): string | undefined {
  return request.ip;
}

function getUserAgent(request: FastifyRequest): string | undefined {
  const value = request.headers['user-agent'];
  return Array.isArray(value) ? value[0] : value;
}

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
  return {
    requestId: request.requestContext.requestId,
    sessionId: actor.sessionId,
    ipAddress: getIp(request),
    userAgent: getUserAgent(request),
  };
}

export const auditorAccessRoutes: FastifyPluginAsync = async (app) => {
  async function listGrants(request: FastifyRequest, reply: any) {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = AuditorAccessListQuerySchema.parse(request.query ?? {});
    return sendData(request, reply, await new AuditorAccessService(app.prisma).listGrants({ tenant, query }));
  }

  async function createGrant(request: FastifyRequest, reply: any) {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const body = CreateAuditorAccessGrantBodySchema.parse(request.body ?? {});
    const data = await new AuditorAccessService(app.prisma).createGrant({
      tenant,
      body,
      audit: auditContext(request),
    });
    return reply.status(201).send({ data, meta: { requestId: request.requestContext.requestId } });
  }

  async function revokeGrant(request: FastifyRequest, reply: any) {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = AuditorGrantIdParamsSchema.parse(request.params);
    const data = await new AuditorAccessService(app.prisma).revokeGrant({
      tenant,
      grantId: params.grantId,
      audit: auditContext(request),
    });
    return sendData(request, reply, data);
  }

  app.get('/api/auditor-grants', listGrants);
  app.post('/api/auditor-grants', createGrant);
  app.post('/api/auditor-grants/:grantId/revoke', revokeGrant);

  // Backward-compatible aliases from Pass 17/29. Canonical routes above are the v2.1 completion surface.
  app.get('/api/auditor-access/grants', listGrants);
  app.post('/api/auditor-access/grants', createGrant);
  app.delete('/api/auditor-access/grants/:grantId', revokeGrant);

  app.get('/api/auditor-access/my-grants', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    return sendData(request, reply, await new AuditorAccessService(app.prisma).listMyGrants({ tenant }));
  });

  app.get('/api/auditor-view/controls', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = AuditorViewListQuerySchema.parse(request.query ?? {});
    return sendData(request, reply, await new AuditorAccessService(app.prisma).listAuditorViewControls({ tenant, query }));
  });

  app.get('/api/auditor-view/evidence', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = AuditorViewListQuerySchema.parse(request.query ?? {});
    return sendData(request, reply, await new AuditorAccessService(app.prisma).listAuditorViewEvidence({ tenant, query }));
  });

  app.get('/api/auditor-view/reports', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = AuditorViewListQuerySchema.parse(request.query ?? {});
    return sendData(request, reply, await new AuditorAccessService(app.prisma).listAuditorViewReports({ tenant, query }));
  });
};
