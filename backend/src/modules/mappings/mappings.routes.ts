import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import { sendData } from '../../shared/response.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { ApproveMappingBodySchema, CreateManualMappingBodySchema, EvidenceVersionMappingParamsSchema, MappingIdParamsSchema, MappingListQuerySchema, RejectMappingBodySchema } from './mapping.schemas.js';
import { MappingsService } from './mappings.service.js';

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

export const mappingsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/evidence/versions/:versionId/mappings', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = EvidenceVersionMappingParamsSchema.parse(request.params);
    const body = CreateManualMappingBodySchema.parse(request.body ?? {});
    const actor = requireAuthenticatedUser(request);

    const data = await new MappingsService(app.prisma).createManualMapping({
      tenant,
      versionId: params.versionId,
      body,
      audit: {
        requestId: request.requestContext.requestId,
        sessionId: actor.sessionId,
        ipAddress: getIp(request),
        userAgent: getUserAgent(request),
      },
    });

    return reply.status(201).send({ data, meta: { requestId: request.requestContext.requestId } });
  });

  app.get('/api/evidence/versions/:versionId/mappings', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = EvidenceVersionMappingParamsSchema.parse(request.params);
    const query = MappingListQuerySchema.parse(request.query ?? {});
    const items = await new MappingsService(app.prisma).listMappingsForEvidenceVersion({ tenant, versionId: params.versionId, query });
    return sendData(request, reply, { items });
  });

  app.post('/api/mappings/:id/approve', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = MappingIdParamsSchema.parse(request.params);
    const body = ApproveMappingBodySchema.parse(request.body ?? {});
    const actor = requireAuthenticatedUser(request);

    const data = await new MappingsService(app.prisma).approveMapping({
      tenant,
      mappingId: params.id,
      body,
      audit: {
        requestId: request.requestContext.requestId,
        sessionId: actor.sessionId,
        ipAddress: getIp(request),
        userAgent: getUserAgent(request),
      },
    });

    return sendData(request, reply, data);
  });

  app.post('/api/mappings/:id/reject', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = MappingIdParamsSchema.parse(request.params);
    const body = RejectMappingBodySchema.parse(request.body ?? {});
    const actor = requireAuthenticatedUser(request);

    const data = await new MappingsService(app.prisma).rejectMapping({
      tenant,
      mappingId: params.id,
      body,
      audit: {
        requestId: request.requestContext.requestId,
        sessionId: actor.sessionId,
        ipAddress: getIp(request),
        userAgent: getUserAgent(request),
      },
    });

    return sendData(request, reply, data);
  });
};
