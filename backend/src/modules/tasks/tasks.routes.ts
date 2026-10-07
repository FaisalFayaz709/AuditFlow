import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import { sendData } from '../../shared/response.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { CancelTaskBodySchema, CompleteTaskBodySchema, CreateTaskBodySchema, RejectTaskBodySchema, SubmitTaskEvidenceBodySchema, TaskIdParamsSchema, TaskListQuerySchema, UpdateTaskBodySchema } from './task.schemas.js';
import { TasksService } from './tasks.service.js';

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

export const tasksRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/tasks', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const body = CreateTaskBodySchema.parse(request.body ?? {});
    const data = await new TasksService(app.prisma).createTask({ tenant, body, audit: auditContext(request) });
    return reply.status(201).send({ data, meta: { requestId: request.requestContext.requestId } });
  });

  app.get('/api/tasks', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const query = TaskListQuerySchema.parse(request.query ?? {});
    const items = await new TasksService(app.prisma).listTasks({ tenant, query });
    return sendData(request, reply, { items });
  });

  app.get('/api/tasks/:id', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = TaskIdParamsSchema.parse(request.params);
    const data = await new TasksService(app.prisma).getTask({ tenant, taskId: params.id });
    return sendData(request, reply, data);
  });

  app.patch('/api/tasks/:id', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = TaskIdParamsSchema.parse(request.params);
    const body = UpdateTaskBodySchema.parse(request.body ?? {});
    const data = await new TasksService(app.prisma).updateTask({ tenant, taskId: params.id, body, audit: auditContext(request) });
    return sendData(request, reply, data);
  });

  app.post('/api/tasks/:id/start', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = TaskIdParamsSchema.parse(request.params);
    const data = await new TasksService(app.prisma).startTask({ tenant, taskId: params.id, audit: auditContext(request) });
    return sendData(request, reply, data);
  });

  app.post('/api/tasks/:id/submit-evidence', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = TaskIdParamsSchema.parse(request.params);
    const body = SubmitTaskEvidenceBodySchema.parse(request.body ?? {});
    const data = await new TasksService(app.prisma).submitEvidence({ tenant, taskId: params.id, body, audit: auditContext(request) });
    return sendData(request, reply, data);
  });

  app.post('/api/tasks/:id/complete', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = TaskIdParamsSchema.parse(request.params);
    const body = CompleteTaskBodySchema.parse(request.body ?? {});
    const data = await new TasksService(app.prisma).completeTask({ tenant, taskId: params.id, body, audit: auditContext(request) });
    return sendData(request, reply, data);
  });

  app.post('/api/tasks/:id/reject', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = TaskIdParamsSchema.parse(request.params);
    const body = RejectTaskBodySchema.parse(request.body ?? {});
    const data = await new TasksService(app.prisma).rejectTask({ tenant, taskId: params.id, body, audit: auditContext(request) });
    return sendData(request, reply, data);
  });

  app.post('/api/tasks/:id/cancel', async (request, reply) => {
    const tenant = await resolveTenantFromHeader(request);
    if (!tenant) return reply.status(400).send(activeCompanyRequired(request));
    const params = TaskIdParamsSchema.parse(request.params);
    const body = CancelTaskBodySchema.parse(request.body ?? {});
    const data = await new TasksService(app.prisma).cancelTask({ tenant, taskId: params.id, body, audit: auditContext(request) });
    return sendData(request, reply, data);
  });
};
