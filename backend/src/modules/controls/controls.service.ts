import type { PrismaClient } from '@prisma/client';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import { AppError } from '../../shared/errors.js';
import { requirePermission } from '../authz/permissions.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { CompanyControlStateBody, ControlsQuery } from './control.schemas.js';
import { ControlsRepository } from './controls.repository.js';

export function assertCompanyControlStateAllowed(params: {
  body: CompanyControlStateBody;
  ownerMembership: { user_id: string; role: string } | null;
}): void {
  if (params.body.applicability === 'NOT_APPLICABLE' && !params.body.notApplicableReason) {
    throw new AppError({
      statusCode: 422,
      code: 'NOT_APPLICABLE_REASON_REQUIRED',
      message: 'A reason is required when marking a control NOT_APPLICABLE.',
    });
  }

  if (params.body.ownerUserId && !params.ownerMembership) {
    throw new AppError({
      statusCode: 422,
      code: 'OWNER_MUST_BE_ACTIVE_MEMBER',
      message: 'Control owner must be an active member of this company.',
      details: [{ field: 'ownerUserId', reason: params.body.ownerUserId }],
    });
  }
}

export class ControlsService {
  constructor(private readonly prisma: PrismaClient) {}

  async listControls(tenant: TenantContext, query: ControlsQuery) {
    requirePermission(tenant, 'company.read');
    return new ControlsRepository(this.prisma).listControlsInTenantScope(tenant, query);
  }

  async getControlDetail(tenant: TenantContext, companyControlId: string) {
    requirePermission(tenant, 'company.read');
    const control = await new ControlsRepository(this.prisma).findCompanyControlInTenantScope({ tenant, companyControlId });
    if (!control) {
      throw new AppError({ statusCode: 404, code: 'CONTROL_NOT_FOUND', message: 'Control was not found.' });
    }
    return control;
  }

  async updateCompanyControlState(params: {
    tenant: TenantContext;
    companyControlId: string;
    body: CompanyControlStateBody;
    requestId: string;
    sessionId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }) {
    requirePermission(params.tenant, 'controls.manage');

    return this.prisma.$transaction(async (tx) => {
      const repository = new ControlsRepository(tx);
      const before = await repository.findCompanyControlInTenantScope({
        tenant: params.tenant,
        companyControlId: params.companyControlId,
      });
      if (!before) {
        throw new AppError({ statusCode: 404, code: 'CONTROL_NOT_FOUND', message: 'Control was not found.' });
      }

      const ownerMembership = params.body.ownerUserId
        ? await repository.findActiveMemberInCompany({ companyId: params.tenant.companyId, userId: params.body.ownerUserId })
        : null;

      assertCompanyControlStateAllowed({ body: params.body, ownerMembership });

      const nextApplicability = params.body.applicability ?? before.applicability;
      const data = {
        ...(params.body.ownerUserId !== undefined ? { owner_user_id: params.body.ownerUserId } : {}),
        ...(params.body.applicability === 'APPLICABLE'
          ? {
              applicability: 'APPLICABLE' as const,
              not_applicable_reason: null,
              not_applicable_approved_by: null,
            }
          : {}),
        ...(params.body.applicability === 'NOT_APPLICABLE'
          ? {
              applicability: 'NOT_APPLICABLE' as const,
              not_applicable_reason: params.body.notApplicableReason?.trim(),
              not_applicable_approved_by: params.tenant.userId,
            }
          : {}),
        ...(params.body.applicability === undefined && nextApplicability === 'NOT_APPLICABLE' && params.body.notApplicableReason !== undefined
          ? { not_applicable_reason: params.body.notApplicableReason?.trim() ?? before.not_applicable_reason }
          : {}),
      };

      const updated = await tx.companyControl.update({
        where: { id: params.companyControlId },
        data,
        select: {
          id: true,
          applicability: true,
          not_applicable_reason: true,
          not_applicable_approved_by: true,
          owner_user_id: true,
          control: { select: { id: true, code: true, title: true, risk_level: true, control_type: true } },
        },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.sessionId,
        action: 'CONTROL_APPLICABILITY_CHANGED',
        entityType: 'company_control',
        entityId: params.companyControlId,
        metadata: {
          before: {
            applicability: before.applicability,
            notApplicableReason: before.not_applicable_reason,
            ownerUserId: before.owner_user_id,
          },
          after: {
            applicability: updated.applicability,
            notApplicableReason: updated.not_applicable_reason,
            ownerUserId: updated.owner_user_id,
          },
          controlCode: updated.control.code,
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });

      if (before.owner_user_id !== updated.owner_user_id) {
        await new AuditLogService(tx).recordEvent({
          tenant: params.tenant,
          sessionId: params.sessionId,
          action: 'CONTROL_OWNER_CHANGED',
          entityType: 'company_control',
          entityId: params.companyControlId,
          metadata: {
            beforeOwnerUserId: before.owner_user_id,
            afterOwnerUserId: updated.owner_user_id,
            controlCode: updated.control.code,
          },
          actorSnapshot: { role: params.tenant.role },
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          requestId: params.requestId,
        });
      }

      return updated;
    });
  }
}
