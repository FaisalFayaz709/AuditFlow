import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { AppEnv } from '../../config/env.js';
import { sendData } from '../../shared/response.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import {
  AcceptInvitationParamsSchema,
  InvitationIdParamsSchema,
  InviteMemberBodySchema,
  InviteMemberParamsSchema,
  ResendInvitationBodySchema,
} from './invitations.schemas.js';
import { InvitationsService } from './invitations.service.js';

function getIp(request: FastifyRequest): string | undefined {
  return request.ip;
}

function getUserAgent(request: FastifyRequest): string | undefined {
  const value = request.headers['user-agent'];
  return Array.isArray(value) ? value[0] : value;
}

async function resolveTenant(request: FastifyRequest, companyId: string) {
  const actor = requireAuthenticatedUser(request);
  return requireCompanyMembership({
    lookup: new PrismaCompanyMembershipLookup(request.server.prisma),
    userId: actor.userId,
    companyId,
  });
}

export const invitationsRoutes: FastifyPluginAsync<{ env: AppEnv }> = async (app, { env }) => {
  app.get('/api/companies/:id/invitations', async (request, reply) => {
    const params = InviteMemberParamsSchema.parse(request.params);
    const tenant = await resolveTenant(request, params.id);
    return sendData(request, reply, { items: await new InvitationsService(app.prisma, env).listCompanyInvitations(tenant) });
  });

  app.post('/api/companies/:id/invitations', async (request, reply) => {
    const params = InviteMemberParamsSchema.parse(request.params);
    const body = InviteMemberBodySchema.parse(request.body);
    const actor = requireAuthenticatedUser(request);
    const tenant = await resolveTenant(request, params.id);

    const data = await new InvitationsService(app.prisma, env).inviteMember({
      tenant,
      body,
      requestId: request.requestContext.requestId,
      sessionId: actor.sessionId,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
    });

    return reply.status(201).send({ data, meta: { requestId: request.requestContext.requestId } });
  });

  app.post('/api/invitations/:token/accept', async (request, reply) => {
    const actor = requireAuthenticatedUser(request);
    const params = AcceptInvitationParamsSchema.parse(request.params);
    const data = await new InvitationsService(app.prisma, env).acceptInvitation({
      token: params.token,
      userId: actor.userId,
      requestId: request.requestContext.requestId,
      sessionId: actor.sessionId,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
    });

    return sendData(request, reply, data);
  });

  app.post('/api/companies/:id/invitations/:invitationId/resend', async (request, reply) => {
    const params = InvitationIdParamsSchema.parse(request.params);
    const body = ResendInvitationBodySchema.parse(request.body ?? {});
    const actor = requireAuthenticatedUser(request);
    const tenant = await resolveTenant(request, params.id);

    const data = await new InvitationsService(app.prisma, env).resendInvitation({
      tenant,
      invitationId: params.invitationId,
      body,
      requestId: request.requestContext.requestId,
      sessionId: actor.sessionId,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
    });

    return sendData(request, reply, data);
  });

  app.delete('/api/companies/:id/invitations/:invitationId', async (request, reply) => {
    const params = InvitationIdParamsSchema.parse(request.params);
    const actor = requireAuthenticatedUser(request);
    const tenant = await resolveTenant(request, params.id);

    await new InvitationsService(app.prisma, env).revokeInvitation({
      tenant,
      invitationId: params.invitationId,
      requestId: request.requestContext.requestId,
      sessionId: actor.sessionId,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
    });

    return reply.status(204).send();
  });
};
