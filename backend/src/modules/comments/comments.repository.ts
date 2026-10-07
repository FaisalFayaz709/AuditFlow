import type { Prisma, PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { CommentEntityType, CommentListQuery } from './comment.schemas.js';

export type CommentTargetAuthorization =
  | { entityType: 'TASK'; entityId: string; assignedToUserId: string | null }
  | { entityType: 'COMPANY_CONTROL'; entityId: string }
  | { entityType: 'EVIDENCE_ITEM'; entityId: string }
  | { entityType: 'EVIDENCE_VERSION'; entityId: string };


export type Db = PrismaClient | Prisma.TransactionClient;

export class CommentsRepository {
  constructor(private readonly prisma: Db) {}

  listComments(params: { tenant: TenantContext; query: CommentListQuery; auditorVisibleOnly?: boolean }) {
    return this.prisma.comment.findMany({
      where: {
        company_id: params.tenant.companyId,
        entity_type: params.query.entityType,
        entity_id: params.query.entityId,
        ...(params.query.includeArchived ? {} : { archived_at: null }),
        ...(params.auditorVisibleOnly ? { visibility: 'AUDITOR_VISIBLE' } : {}),
      },
      orderBy: { created_at: 'asc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  findCommentInTenantScope(params: { tenant: TenantContext; commentId: string }) {
    return this.prisma.comment.findFirst({
      where: { id: params.commentId, company_id: params.tenant.companyId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async findTargetAuthorizationInTenantScope(params: { tenant: TenantContext; entityType: CommentEntityType; entityId: string }): Promise<CommentTargetAuthorization | null> {
    switch (params.entityType) {
      case 'TASK': {
        const task = await this.prisma.task.findFirst({
          where: { id: params.entityId, company_id: params.tenant.companyId },
          select: { id: true, assigned_to_user_id: true },
        });
        return task ? { entityType: 'TASK', entityId: task.id, assignedToUserId: task.assigned_to_user_id } : null;
      }
      case 'COMPANY_CONTROL': {
        const control = await this.prisma.companyControl.findFirst({
          where: { id: params.entityId, company_framework: { company_id: params.tenant.companyId } },
          select: { id: true },
        });
        return control ? { entityType: 'COMPANY_CONTROL', entityId: control.id } : null;
      }
      case 'EVIDENCE_ITEM': {
        const evidenceItem = await this.prisma.evidenceItem.findFirst({
          where: { id: params.entityId, company_id: params.tenant.companyId },
          select: { id: true },
        });
        return evidenceItem ? { entityType: 'EVIDENCE_ITEM', entityId: evidenceItem.id } : null;
      }
      case 'EVIDENCE_VERSION': {
        const version = await this.prisma.evidenceVersion.findFirst({
          where: { id: params.entityId, evidence_item: { company_id: params.tenant.companyId } },
          select: { id: true },
        });
        return version ? { entityType: 'EVIDENCE_VERSION', entityId: version.id } : null;
      }
      default:
        return null;
    }
  }

  async entityExistsInTenantScope(params: { tenant: TenantContext; entityType: CommentEntityType; entityId: string }) {
    return Boolean(await this.findTargetAuthorizationInTenantScope(params));
  }
}
