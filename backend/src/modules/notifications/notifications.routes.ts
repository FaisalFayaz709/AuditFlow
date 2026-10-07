import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { sendData } from '../../shared/response.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationIdParamsSchema, NotificationListQuerySchema, NotificationPreferenceUpdateSchema } from './notifications.schemas.js';
import type { AppEnv } from '../../config/env.js';

function getHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

async function resolveTenantFromHeader(request: FastifyRequest) {
  const actor = requireAuthenticatedUser(request);
  const companyId = getHeader(request, 'x-auditflow-company-id');
  if (!companyId) return null;
  return requireCompanyMembership({ lookup: new PrismaCompanyMembershipLookup(request.server.prisma), userId: actor.userId, companyId });
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

export const notificationsRoutes: FastifyPluginAsync<{ env: AppEnv }> = async (app, { env }) => {
  app.get('/api/notifications', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = NotificationListQuerySchema.parse(request.query ?? {});
    const data = await new NotificationsService(app.prisma, env).listForUser({ tenant, query });
    return sendData(request, reply, data);
  });

  app.post('/api/notifications/:id/read', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = NotificationIdParamsSchema.parse(request.params);
    const data = await new NotificationsService(app.prisma, env).markRead({ tenant, notificationId: params.id, audit: auditContext(request) });
    return sendData(request, reply, data);
  });

  app.get('/api/notifications/preferences', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const data = await new NotificationsService(app.prisma, env).listPreferences({ tenant });
    return sendData(request, reply, data);
  });

  app.patch('/api/notifications/preferences', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const body = NotificationPreferenceUpdateSchema.parse(request.body ?? {});
    const data = await new NotificationsService(app.prisma, env).updatePreferences({ tenant, body, audit: auditContext(request) });
    return sendData(request, reply, data);
  });
};
