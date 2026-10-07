import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { sendData } from '../../shared/response.js';
import {
  ApproveDeletionRequestBodySchema,
  CancelDeletionRequestBodySchema,
  CreateDeletionRequestBodySchema,
  CreateLegalHoldBodySchema,
  DeletionRequestIdParamsSchema,
  DeletionRequestListQuerySchema,
  LegalHoldIdParamsSchema,
  LegalHoldListQuerySchema,
} from './retention.schemas.js';
import { RetentionService } from './retention.service.js';

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

export const retentionRoutes: FastifyPluginAsync = async (app) => {

  app.get('/api/retention/policy', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    return sendData(request, reply, await new RetentionService(app.prisma).getRetentionPolicy({ tenant }));
  });
  app.get('/api/retention/deletion-requests', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = DeletionRequestListQuerySchema.parse(request.query ?? {});
    return sendData(request, reply, await new RetentionService(app.prisma).listDeletionRequests({ tenant, query }));
  });

  app.post('/api/retention/deletion-requests', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const body = CreateDeletionRequestBodySchema.parse(request.body ?? {});
    const data = await new RetentionService(app.prisma).createDeletionRequest({ tenant, body, audit: auditContext(request) });
    return reply.status(201).send({ data, meta: { requestId: request.requestContext.requestId } });
  });

  app.post('/api/retention/deletion-requests/:deletionRequestId/approve', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = DeletionRequestIdParamsSchema.parse(request.params);
    const body = ApproveDeletionRequestBodySchema.parse(request.body ?? {});
    return sendData(request, reply, await new RetentionService(app.prisma).approveDeletionRequest({ tenant, deletionRequestId: params.deletionRequestId, body, audit: auditContext(request) }));
  });

  app.post('/api/retention/deletion-requests/:deletionRequestId/cancel', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = DeletionRequestIdParamsSchema.parse(request.params);
    const body = CancelDeletionRequestBodySchema.parse(request.body ?? {});
    return sendData(request, reply, await new RetentionService(app.prisma).cancelDeletionRequest({ tenant, deletionRequestId: params.deletionRequestId, body, audit: auditContext(request) }));
  });

  app.post('/api/retention/deletion-requests/run-due', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    return sendData(request, reply, await new RetentionService(app.prisma).runDueDeletionRequests({ tenant, audit: auditContext(request) }));
  });

  app.get('/api/retention/legal-holds', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = LegalHoldListQuerySchema.parse(request.query ?? {});
    return sendData(request, reply, await new RetentionService(app.prisma).listLegalHolds({ tenant, query }));
  });

  app.post('/api/retention/legal-holds', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const body = CreateLegalHoldBodySchema.parse(request.body ?? {});
    const data = await new RetentionService(app.prisma).createLegalHold({ tenant, body, audit: auditContext(request) });
    return reply.status(201).send({ data, meta: { requestId: request.requestContext.requestId } });
  });

  app.post('/api/retention/legal-holds/:legalHoldId/release', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = LegalHoldIdParamsSchema.parse(request.params);
    return sendData(request, reply, await new RetentionService(app.prisma).releaseLegalHold({ tenant, legalHoldId: params.legalHoldId, audit: auditContext(request) }));
  });
};
