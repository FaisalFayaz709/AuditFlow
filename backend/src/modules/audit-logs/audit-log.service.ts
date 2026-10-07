import type { Prisma, PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../shared/tenant-context.js';

export type AuditEventInput = {
  tenant: TenantContext;
  sessionId?: string | undefined;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | undefined;
  actorSnapshot?: Record<string, unknown> | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId: string;
};

type AuditLogClient = Pick<PrismaClient | Prisma.TransactionClient, 'auditLog'>;

export class AuditLogService {
  constructor(private readonly prisma: AuditLogClient) {}

  async recordEvent(input: AuditEventInput): Promise<{ id: string }> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      company_id: input.tenant.companyId,
      user_id: input.tenant.userId,
      session_id: input.sessionId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      metadata_json: input.metadata ?? {},
      actor_snapshot_json: input.actorSnapshot ?? {},
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      request_id: input.requestId,
    };

    return this.prisma.auditLog.create({ data, select: { id: true } });
  }

  async listForTenant(params: {
    tenant: TenantContext;
    limit: number;
    cursor?: string | undefined;
    action?: string | undefined;
    entityType?: string | undefined;
  }): Promise<{
    items: Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      metadata: unknown;
      actorSnapshot: unknown;
      requestId: string;
      createdAt: string;
    }>;
    nextCursor: string | null;
  }> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        company_id: params.tenant.companyId,
        ...(params.action ? { action: params.action } : {}),
        ...(params.entityType ? { entity_type: params.entityType } : {}),
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        entity_type: true,
        entity_id: true,
        metadata_json: true,
        actor_snapshot_json: true,
        request_id: true,
        created_at: true,
      },
    });

    const page = rows.slice(0, params.limit);
    const next = rows.length > params.limit ? rows[params.limit]?.id ?? null : null;

    return {
      items: page.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: row.metadata_json,
        actorSnapshot: row.actor_snapshot_json,
        requestId: row.request_id,
        createdAt: row.created_at.toISOString(),
      })),
      nextCursor: next,
    };
  }
}
