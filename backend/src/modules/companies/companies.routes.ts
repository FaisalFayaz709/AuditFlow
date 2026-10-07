import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { requirePermission } from '../authz/permissions.js';
import { sendData } from '../../shared/response.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { PrismaCompanyMembershipLookup } from './companies.repository.js';
import { CompaniesService } from './companies.service.js';
import {
  CompanyCreateBodySchema,
  CompanyIdParamsSchema,
  CompanyMembersParamsSchema,
  CompanyUpdateBodySchema,
  MemberIdParamsSchema,
  RemoveMemberBodySchema,
  RoleChangeBodySchema,
} from './company.schemas.js';

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

export const companiesRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/companies', async (request, reply) => {
    const actor = requireAuthenticatedUser(request);
    const body = CompanyCreateBodySchema.parse(request.body);
    const data = await new CompaniesService(app.prisma).createCompany({
      userId: actor.userId,
      body,
      requestId: request.requestContext.requestId,
      sessionId: actor.sessionId,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
    });

    return reply.status(201).send({ data, meta: { requestId: request.requestContext.requestId } });
  });

  app.get('/api/companies/current', async (request, reply) => {
    const actor = requireAuthenticatedUser(request);
    const companyIdHeader = request.headers['x-auditflow-company-id'];
    const companyId = Array.isArray(companyIdHeader) ? companyIdHeader[0] : companyIdHeader;
    if (!companyId) {
      return reply.status(400).send({
        error: {
          code: 'ACTIVE_COMPANY_REQUIRED',
          message: 'Send x-auditflow-company-id to select a company context.',
          requestId: request.requestContext.requestId,
          details: [{ field: 'x-auditflow-company-id', reason: 'required' }],
        },
      });
    }

    const tenant = await requireCompanyMembership({
      lookup: new PrismaCompanyMembershipLookup(app.prisma),
      userId: actor.userId,
      companyId,
    });
    requirePermission(tenant, 'company.read');
    return sendData(request, reply, await new CompaniesService(app.prisma).getCurrentCompany(tenant));
  });

  app.patch('/api/companies/:id', async (request, reply) => {
    const params = CompanyIdParamsSchema.parse(request.params);
    const body = CompanyUpdateBodySchema.parse(request.body);
    const actor = requireAuthenticatedUser(request);
    const tenant = await resolveTenant(request, params.id);

    const data = await new CompaniesService(app.prisma).updateCompany({
      tenant,
      body,
      requestId: request.requestContext.requestId,
      sessionId: actor.sessionId,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
    });

    return sendData(request, reply, data);
  });

  app.get('/api/companies/:id/members', async (request, reply) => {
    const params = CompanyMembersParamsSchema.parse(request.params);
    const tenant = await resolveTenant(request, params.id);
    return sendData(request, reply, { items: await new CompaniesService(app.prisma).listMembers(tenant) });
  });

  app.patch('/api/companies/:companyId/members/:memberId/role', async (request, reply) => {
    const params = MemberIdParamsSchema.parse(request.params);
    const body = RoleChangeBodySchema.parse(request.body);
    const actor = requireAuthenticatedUser(request);
    const tenant = await resolveTenant(request, params.companyId);

    const data = await new CompaniesService(app.prisma).changeMemberRole({
      tenant,
      memberId: params.memberId,
      body,
      requestId: request.requestContext.requestId,
      sessionId: actor.sessionId,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
    });

    return sendData(request, reply, data);
  });

  app.delete('/api/companies/:companyId/members/:memberId', async (request, reply) => {
    const params = MemberIdParamsSchema.parse(request.params);
    const body = RemoveMemberBodySchema.parse(request.body ?? {});
    const actor = requireAuthenticatedUser(request);
    const tenant = await resolveTenant(request, params.companyId);

    await new CompaniesService(app.prisma).removeMember({
      tenant,
      memberId: params.memberId,
      body,
      requestId: request.requestContext.requestId,
      sessionId: actor.sessionId,
      ipAddress: getIp(request),
      userAgent: getUserAgent(request),
    });

    return reply.status(204).send();
  });
};
