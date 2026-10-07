import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors.js';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import { sendData } from '../../shared/response.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import {
  FrameworkEnableBodySchema,
  FrameworkEnableParamsSchema,
  FrameworkIdParamsSchema,
  FrameworkUpgradeActivateBodySchema,
  FrameworkUpgradeDraftParamsSchema,
  FrameworkUpgradePreviewBodySchema,
  FrameworkUpgradePreviewParamsSchema,
} from './framework.schemas.js';
import { FrameworkUpgradeService } from './framework-upgrade.service.js';
import { FrameworksService } from './frameworks.service.js';

function getIp(request: FastifyRequest): string | undefined {
  return request.ip;
}

function getUserAgent(request: FastifyRequest): string | undefined {
  const value = request.headers['user-agent'];
  return Array.isArray(value) ? value[0] : value;
}

function getCompanyHeader(request: FastifyRequest): string {
  const companyIdHeader = request.headers['x-auditflow-company-id'];
  const companyId = Array.isArray(companyIdHeader) ? companyIdHeader[0] : companyIdHeader;
  if (!companyId) {
    throw new AppError({
      statusCode: 400,
      code: 'COMPANY_CONTEXT_REQUIRED',
      message: 'Send x-auditflow-company-id to select a company context.',
      details: [{ field: 'x-auditflow-company-id', reason: 'required' }],
    });
  }
  return companyId;
}

export const frameworksRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/frameworks', async (request, reply) => {
    return sendData(request, reply, { items: await new FrameworksService(app.prisma).listPublishedFrameworks() });
  });

  app.get('/api/frameworks/:id', async (request, reply) => {
    const params = FrameworkIdParamsSchema.parse(request.params);
    return sendData(request, reply, await new FrameworksService(app.prisma).getFrameworkDetail(params.id));
  });

  app.post('/api/companies/:companyId/frameworks/:frameworkVersionId/enable', async (request, reply) => {
    const params = FrameworkEnableParamsSchema.parse(request.params);
    const body = FrameworkEnableBodySchema.parse(request.body ?? {});
    const actor = requireAuthenticatedUser(request);
    const tenant = await requireCompanyMembership({
      lookup: new PrismaCompanyMembershipLookup(app.prisma),
      userId: actor.userId,
      companyId: params.companyId,
    });

    const data = await new FrameworksService(app.prisma).enableFrameworkVersion({
      tenant,
      frameworkVersionId: params.frameworkVersionId,
      body,
      requestId: request.requestContext.requestId,
      sessionId: actor.sessionId,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
    });

    return reply.status(201).send({ data, meta: { requestId: request.requestContext.requestId } });
  });

  app.post('/api/frameworks/enrollments/:enrollmentId/upgrade-preview', async (request, reply) => {
    const params = FrameworkUpgradePreviewParamsSchema.parse(request.params);
    const body = FrameworkUpgradePreviewBodySchema.parse(request.body ?? {});
    const actor = requireAuthenticatedUser(request);
    const tenant = await requireCompanyMembership({
      lookup: new PrismaCompanyMembershipLookup(app.prisma),
      userId: actor.userId,
      companyId: getCompanyHeader(request),
    });

    const data = await new FrameworkUpgradeService(app.prisma).createUpgradePreview({
      tenant,
      oldEnrollmentId: params.enrollmentId,
      body,
      requestId: request.requestContext.requestId,
      sessionId: actor.sessionId,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
    });

    return reply.status(201).send({ data, meta: { requestId: request.requestContext.requestId } });
  });

  app.get('/api/frameworks/enrollments/:draftEnrollmentId/reconciliation', async (request, reply) => {
    const params = FrameworkUpgradeDraftParamsSchema.parse(request.params);
    const actor = requireAuthenticatedUser(request);
    const tenant = await requireCompanyMembership({
      lookup: new PrismaCompanyMembershipLookup(app.prisma),
      userId: actor.userId,
      companyId: getCompanyHeader(request),
    });

    return sendData(request, reply, await new FrameworkUpgradeService(app.prisma).getReconciliation({ tenant, draftEnrollmentId: params.draftEnrollmentId }));
  });

  app.post('/api/frameworks/enrollments/:draftEnrollmentId/activate-upgrade', async (request, reply) => {
    const params = FrameworkUpgradeDraftParamsSchema.parse(request.params);
    const body = FrameworkUpgradeActivateBodySchema.parse(request.body ?? {});
    const actor = requireAuthenticatedUser(request);
    const tenant = await requireCompanyMembership({
      lookup: new PrismaCompanyMembershipLookup(app.prisma),
      userId: actor.userId,
      companyId: getCompanyHeader(request),
    });

    const data = await new FrameworkUpgradeService(app.prisma).activateUpgrade({
      tenant,
      draftEnrollmentId: params.draftEnrollmentId,
      body,
      requestId: request.requestContext.requestId,
      sessionId: actor.sessionId,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
    });

    return sendData(request, reply, data);
  });
};
