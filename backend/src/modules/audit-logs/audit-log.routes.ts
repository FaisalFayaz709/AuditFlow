import type { FastifyPluginAsync } from 'fastify';
import { PrismaCompanyMembershipLookup } from '../companies/companies.repository.js';
import { requirePermission } from '../authz/permissions.js';
import { requireAuthenticatedUser, requireCompanyMembership } from '../../shared/tenant-boundary.js';
import { sendData } from '../../shared/response.js';
import { AuditLogListQuerySchema } from './audit-log.schemas.js';
import { AuditLogService } from './audit-log.service.js';

export const auditLogRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/audit-logs', async (request, reply) => {
    const actor = requireAuthenticatedUser(request);
    const query = AuditLogListQuerySchema.parse(request.query);
    const tenant = await requireCompanyMembership({
      lookup: new PrismaCompanyMembershipLookup(app.prisma),
      userId: actor.userId,
      companyId: query.companyId,
    });
    requirePermission(tenant, 'audit_logs.read');

    const service = new AuditLogService(app.prisma);
    return sendData(request, reply, await service.listForTenant({
      tenant,
      limit: query.limit,
      cursor: query.cursor,
      action: query.action,
      entityType: query.entityType,
    }));
  });
};
