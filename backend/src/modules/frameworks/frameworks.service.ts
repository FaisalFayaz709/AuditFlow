import type { PrismaClient } from '@prisma/client';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import { AppError } from '../../shared/errors.js';
import { requirePermission } from '../authz/permissions.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { FrameworkEnableBody } from './framework.schemas.js';
import { FrameworksRepository } from './frameworks.repository.js';

type PublishableFrameworkVersion = {
  controls: Array<{
    id: string;
    code?: string | null;
    control_type: string;
    sort_order?: number | null;
    evidence_requirements: Array<{
      id: string;
      code?: string | null;
      required?: boolean;
      sort_order?: number | null;
    }>;
  }>;
};

function throwFrameworkPublishableError(field: string, reason: string): never {
  throw new AppError({
    statusCode: 422,
    code: 'FRAMEWORK_VERSION_NOT_PUBLISHABLE',
    message:
      'Published framework versions require stable codes, unique sort ordering, and at least one required requirement for each evidence-based control.',
    details: [{ field, reason }],
  });
}

function assertUniqueStableCode(params: { seen: Set<string>; rawCode?: string | null; field: string; id: string }): string {
  const code = params.rawCode?.trim();
  if (!code) throwFrameworkPublishableError(params.field, `${params.id}: missing stable code`);
  if (params.seen.has(code)) throwFrameworkPublishableError(params.field, `${params.id}: duplicate stable code ${code}`);
  params.seen.add(code);
  return code;
}

function assertUniqueSortOrder(params: { seen: Set<number>; sortOrder?: number | null; field: string; id: string }): void {
  if (params.sortOrder === undefined || params.sortOrder === null) return;
  if (params.seen.has(params.sortOrder)) {
    throwFrameworkPublishableError(params.field, `${params.id}: duplicate sort order ${params.sortOrder}`);
  }
  params.seen.add(params.sortOrder);
}

export function validateFrameworkVersionForPublication(version: PublishableFrameworkVersion): void {
  const controlCodes = new Set<string>();
  const controlSortOrders = new Set<number>();

  for (const control of version.controls) {
    const controlCode = assertUniqueStableCode({ seen: controlCodes, rawCode: control.code, field: 'control.code', id: control.id });
    assertUniqueSortOrder({ seen: controlSortOrders, sortOrder: control.sort_order, field: 'control.sortOrder', id: control.id });

    const requiredRequirements = control.evidence_requirements.filter((requirement) => requirement.required !== false);
    if (control.control_type === 'EVIDENCE_BASED' && requiredRequirements.length === 0) {
      throwFrameworkPublishableError('control.requiredEvidenceRequirements', `${control.id}: ${controlCode}`);
    }

    const requirementCodes = new Set<string>();
    const requirementSortOrders = new Set<number>();
    for (const requirement of control.evidence_requirements) {
      assertUniqueStableCode({
        seen: requirementCodes,
        rawCode: requirement.code,
        field: 'evidenceRequirement.code',
        id: `${controlCode}/${requirement.id}`,
      });
      assertUniqueSortOrder({
        seen: requirementSortOrders,
        sortOrder: requirement.sort_order,
        field: 'evidenceRequirement.sortOrder',
        id: `${controlCode}/${requirement.id}`,
      });
    }
  }
}

export class FrameworksService {
  constructor(private readonly prisma: PrismaClient) {}

  async listPublishedFrameworks() {
    return new FrameworksRepository(this.prisma).listPublishedFrameworks();
  }

  async getFrameworkDetail(frameworkId: string) {
    const framework = await new FrameworksRepository(this.prisma).findFrameworkDetail(frameworkId);
    if (!framework) {
      throw new AppError({ statusCode: 404, code: 'FRAMEWORK_NOT_FOUND', message: 'Framework was not found.' });
    }
    return framework;
  }

  async enableFrameworkVersion(params: {
    tenant: TenantContext;
    frameworkVersionId: string;
    body: FrameworkEnableBody;
    requestId: string;
    sessionId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }) {
    requirePermission(params.tenant, 'frameworks.enable');

    return this.prisma.$transaction(async (tx) => {
      const repository = new FrameworksRepository(tx);
      const version = await repository.findPublishedFrameworkVersion(params.frameworkVersionId);
      if (!version) {
        throw new AppError({
          statusCode: 404,
          code: 'FRAMEWORK_VERSION_NOT_FOUND',
          message: 'Published framework version was not found.',
        });
      }

      validateFrameworkVersionForPublication(version);

      const existingActive = await repository.findActiveEnrollment({
        companyId: params.tenant.companyId,
        frameworkId: version.framework_id,
      });
      if (existingActive) {
        throw new AppError({
          statusCode: 409,
          code: 'ACTIVE_FRAMEWORK_ENROLLMENT_EXISTS',
          message: 'This company already has an active enrollment for this framework family. Use upgrade reconciliation instead.',
          details: [{ field: 'companyFrameworkId', reason: existingActive.id }],
        });
      }

      const enrollment = await tx.companyFramework.create({
        data: {
          company_id: params.tenant.companyId,
          framework_id: version.framework_id,
          framework_version_id: version.id,
          status: 'ACTIVE',
          target_audit_date: params.body.targetAuditDate ? new Date(params.body.targetAuditDate) : null,
          company_controls: {
            create: version.controls.map((control) => ({
              control_id: control.id,
              applicability: 'APPLICABLE',
            })),
          },
        },
        select: {
          id: true,
          company_id: true,
          framework_id: true,
          framework_version_id: true,
          status: true,
          started_at: true,
          target_audit_date: true,
          framework: { select: { name: true } },
          framework_version: { select: { version: true } },
          _count: { select: { company_controls: true } },
        },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.sessionId,
        action: 'FRAMEWORK_ENABLED',
        entityType: 'company_framework',
        entityId: enrollment.id,
        metadata: {
          frameworkId: enrollment.framework_id,
          frameworkVersionId: enrollment.framework_version_id,
          frameworkName: enrollment.framework.name,
          frameworkVersion: enrollment.framework_version.version,
          companyControlCount: enrollment._count.company_controls,
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });

      return {
        id: enrollment.id,
        companyId: enrollment.company_id,
        frameworkId: enrollment.framework_id,
        frameworkVersionId: enrollment.framework_version_id,
        status: enrollment.status,
        startedAt: enrollment.started_at.toISOString(),
        targetAuditDate: enrollment.target_audit_date?.toISOString() ?? null,
        companyControlCount: enrollment._count.company_controls,
      };
    });
  }
}
