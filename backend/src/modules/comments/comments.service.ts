import type { PrismaClient } from '@prisma/client';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import { AppError } from '../../shared/errors.js';
import { hasPermission, requirePermission } from '../authz/permissions.js';
import { assertTaskReadPredicate } from '../authz/predicates.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { CommentListQuery, CreateCommentBody, UpdateCommentBody } from './comment.schemas.js';
import { CommentsRepository, type CommentTargetAuthorization } from './comments.repository.js';

type AuditContext = {
  requestId: string;
  sessionId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
};

function auditBase(audit: AuditContext) {
  return {
    sessionId: audit.sessionId,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
    requestId: audit.requestId,
  };
}


function assertCommentTargetReadable(params: { tenant: TenantContext; target: CommentTargetAuthorization | null }): void {
  if (!params.target) {
    throw new AppError({ statusCode: 404, code: 'COMMENT_ENTITY_NOT_FOUND', message: 'Comment target was not found.' });
  }
  switch (params.target.entityType) {
    case 'TASK':
      assertTaskReadPredicate({ tenant: params.tenant, assignedToUserId: params.target.assignedToUserId });
      return;
    case 'COMPANY_CONTROL':
      requirePermission(params.tenant, 'controls.read');
      return;
    case 'EVIDENCE_ITEM':
    case 'EVIDENCE_VERSION':
      requirePermission(params.tenant, 'evidence.read');
      return;
  }
}

function assertCanMutateComments(tenant: TenantContext): void {
  if (tenant.role === 'AUDITOR') {
    throw new AppError({ statusCode: 403, code: 'AUDITOR_READ_ONLY', message: 'Auditor access is read-only in the MVP workflow.' });
  }
}

export class CommentsService {
  constructor(private readonly prisma: PrismaClient) {}

  async listComments(params: { tenant: TenantContext; query: CommentListQuery }) {
    requirePermission(params.tenant, 'comments.read');
    const repository = new CommentsRepository(this.prisma);
    const target = await repository.findTargetAuthorizationInTenantScope({ tenant: params.tenant, entityType: params.query.entityType, entityId: params.query.entityId });
    assertCommentTargetReadable({ tenant: params.tenant, target });
    return repository.listComments({ ...params, auditorVisibleOnly: params.tenant.role === 'AUDITOR' });
  }

  async createComment(params: { tenant: TenantContext; body: CreateCommentBody; audit: AuditContext }) {
    requirePermission(params.tenant, 'comments.create');
    assertCanMutateComments(params.tenant);
    return this.prisma.$transaction(async (tx) => {
      const repository = new CommentsRepository(tx);
      const target = await repository.findTargetAuthorizationInTenantScope({ tenant: params.tenant, entityType: params.body.entityType, entityId: params.body.entityId });
      assertCommentTargetReadable({ tenant: params.tenant, target });

      const comment = await tx.comment.create({
        data: {
          company_id: params.tenant.companyId,
          user_id: params.tenant.userId,
          entity_type: params.body.entityType,
          entity_id: params.body.entityId,
          visibility: params.body.visibility,
          body: params.body.body,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        ...auditBase(params.audit),
        action: 'COMMENT_CREATED',
        entityType: 'comment',
        entityId: comment.id,
        metadata: { targetEntityType: comment.entity_type, targetEntityId: comment.entity_id, visibility: comment.visibility },
        actorSnapshot: { role: params.tenant.role },
      });
      return comment;
    });
  }

  async updateComment(params: { tenant: TenantContext; commentId: string; body: UpdateCommentBody; audit: AuditContext }) {
    requirePermission(params.tenant, 'comments.update');
    assertCanMutateComments(params.tenant);
    return this.prisma.$transaction(async (tx) => {
      const repository = new CommentsRepository(tx);
      const before = await repository.findCommentInTenantScope({ tenant: params.tenant, commentId: params.commentId });
      if (!before || before.archived_at) throw new AppError({ statusCode: 404, code: 'COMMENT_NOT_FOUND', message: 'Comment was not found.' });
      if (before.user_id !== params.tenant.userId && !hasPermission(params.tenant.role, 'tasks.manage')) {
        throw new AppError({ statusCode: 403, code: 'COMMENT_EDIT_DENIED', message: 'Only the author or an authorized manager may edit this comment.' });
      }

      const updated = await tx.comment.update({
        where: { id: params.commentId },
        data: { body: params.body.body },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        ...auditBase(params.audit),
        action: 'COMMENT_UPDATED',
        entityType: 'comment',
        entityId: params.commentId,
        metadata: { targetEntityType: before.entity_type, targetEntityId: before.entity_id },
        actorSnapshot: { role: params.tenant.role },
      });
      return updated;
    });
  }

  async archiveComment(params: { tenant: TenantContext; commentId: string; audit: AuditContext }) {
    requirePermission(params.tenant, 'comments.delete');
    assertCanMutateComments(params.tenant);
    return this.prisma.$transaction(async (tx) => {
      const repository = new CommentsRepository(tx);
      const before = await repository.findCommentInTenantScope({ tenant: params.tenant, commentId: params.commentId });
      if (!before || before.archived_at) throw new AppError({ statusCode: 404, code: 'COMMENT_NOT_FOUND', message: 'Comment was not found.' });
      if (before.user_id !== params.tenant.userId && !hasPermission(params.tenant.role, 'tasks.manage')) {
        throw new AppError({ statusCode: 403, code: 'COMMENT_ARCHIVE_DENIED', message: 'Only the author or an authorized manager may archive this comment.' });
      }
      const archived = await tx.comment.update({
        where: { id: params.commentId },
        data: { archived_at: new Date() },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        ...auditBase(params.audit),
        action: 'COMMENT_ARCHIVED',
        entityType: 'comment',
        entityId: params.commentId,
        metadata: { targetEntityType: before.entity_type, targetEntityId: before.entity_id },
        actorSnapshot: { role: params.tenant.role },
      });
      return archived;
    });
  }
}
