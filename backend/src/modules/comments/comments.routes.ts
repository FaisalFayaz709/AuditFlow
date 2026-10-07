import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import { sendData } from '../../shared/response.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { CommentIdParamsSchema, CommentListQuerySchema, CreateCommentBodySchema, UpdateCommentBodySchema } from './comment.schemas.js';
import { CommentsService } from './comments.service.js';

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
  return requireCompanyMembership({ lookup: new PrismaCompanyMembershipLookup(request.server.prisma), userId: actor.userId, companyId });
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
  return { requestId: request.requestContext.requestId, sessionId: actor.sessionId, ipAddress: getIp(request), userAgent: getUserAgent(request) };
}

export const commentsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/comments', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = CommentListQuerySchema.parse(request.query ?? {});
    const items = await new CommentsService(app.prisma).listComments({ tenant, query });
    return sendData(request, reply, { items });
  });

  app.post('/api/comments', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const body = CreateCommentBodySchema.parse(request.body ?? {});
    const data = await new CommentsService(app.prisma).createComment({ tenant, body, audit: auditContext(request) });
    return reply.status(201).send({ data, meta: { requestId: request.requestContext.requestId } });
  });

  app.patch('/api/comments/:id', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = CommentIdParamsSchema.parse(request.params);
    const body = UpdateCommentBodySchema.parse(request.body ?? {});
    const data = await new CommentsService(app.prisma).updateComment({ tenant, commentId: params.id, body, audit: auditContext(request) });
    return sendData(request, reply, data);
  });

  app.delete('/api/comments/:id', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = CommentIdParamsSchema.parse(request.params);
    const data = await new CommentsService(app.prisma).archiveComment({ tenant, commentId: params.id, audit: auditContext(request) });
    return sendData(request, reply, data);
  });
};
