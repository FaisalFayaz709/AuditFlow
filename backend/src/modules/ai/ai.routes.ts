import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { AppEnv } from '../../config/env.js';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import { sendData } from '../../shared/response.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { AiSettingsBodySchema, EvidenceVersionAiParamsSchema } from './ai.schemas.js';
import { AiService } from './ai.service.js';

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

export const aiRoutes: FastifyPluginAsync<{ env: AppEnv }> = async (app, { env }) => {
  app.get('/api/companies/current/ai-settings', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const data = await new AiService(app.prisma, env).getCompanyAiSettings(tenant);
    return sendData(request, reply, data);
  });

  app.patch('/api/companies/current/ai-settings', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const body = AiSettingsBodySchema.parse(request.body ?? {});
    const actor = requireAuthenticatedUser(request);
    const data = await new AiService(app.prisma, env).updateCompanyAiSettings({
      tenant,
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

  app.get('/api/evidence/versions/:versionId/ai-analyses', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = EvidenceVersionAiParamsSchema.parse(request.params);
    const items = await new AiService(app.prisma, env).listAnalyses({ tenant, versionId: params.versionId });
    return sendData(request, reply, { items });
  });

  app.post('/api/evidence/versions/:versionId/run-ai-analysis', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = EvidenceVersionAiParamsSchema.parse(request.params);
    const actor = requireAuthenticatedUser(request);
    const data = await new AiService(app.prisma, env).runAnalysis({
      tenant,
      versionId: params.versionId,
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
