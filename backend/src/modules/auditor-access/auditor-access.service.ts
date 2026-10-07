import type { AuditorAccessGrant, AuditorScopeType, Prisma, PrismaClient } from '@prisma/client';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import { AppError } from '../../shared/errors.js';
import { assertExactlyOneRowUpdated, isPrismaUniqueConstraintConflict } from '../../shared/concurrency.js';
import { requirePermission } from '../authz/permissions.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { AuditorAccessListQuery, AuditorViewListQuery, CreateAuditorAccessGrantBody } from './auditor-access.schemas.js';

export type AuditorAccessAuditContext = {
  requestId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export const AUDITOR_ACCESS_DEFAULT_MAX_DAYS = 90;
const MAX_GRANT_DAYS = AUDITOR_ACCESS_DEFAULT_MAX_DAYS; // MAX_GRANT_DAYS = 90 locked-spec compatibility marker

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function iso(value: Date): string {
  return value.toISOString();
}

export function activeWindow(now: Date) {
  return {
    revoked_at: null,
    starts_at: { lte: now },
    expires_at: { gt: now },
  } as const;
}

function serializeGrant(grant: AuditorAccessGrant) {
  return {
    id: grant.id,
    companyId: grant.company_id,
    auditorMemberId: grant.auditor_member_id,
    scopeType: grant.scope_type,
    scopeId: grant.scope_id,
    startsAt: iso(grant.starts_at),
    expiresAt: iso(grant.expires_at),
    downloadAllowed: grant.download_allowed,
    grantedByUserId: grant.granted_by_user_id,
    revokedByUserId: grant.revoked_by_user_id,
    revokedAt: grant.revoked_at ? iso(grant.revoked_at) : null,
    createdAt: iso(grant.created_at),
  };
}

export class AuditorAccessService {
  constructor(private readonly prisma: PrismaClient) {}

  async listGrants(params: { tenant: TenantContext; query: AuditorAccessListQuery }) {
    requirePermission(params.tenant, 'auditor_grants.manage');
    const skip = (params.query.page - 1) * params.query.limit;
    const where: Prisma.AuditorAccessGrantWhereInput = {
      company_id: params.tenant.companyId,
      ...(params.query.auditorMemberId ? { auditor_member_id: params.query.auditorMemberId } : {}),
      ...(params.query.scopeType ? { scope_type: params.query.scopeType } : {}),
      ...(params.query.includeRevoked ? {} : { revoked_at: null }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditorAccessGrant.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip, take: params.query.limit }),
      this.prisma.auditorAccessGrant.count({ where }),
    ]);
    return {
      items: items.map(serializeGrant),
      pagination: {
        page: params.query.page,
        limit: params.query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.query.limit)),
      },
    };
  }

  async listMyGrants(params: { tenant: TenantContext; now?: Date }) {
    requirePermission(params.tenant, 'auditor_grants.read');
    this.assertAuditorRole(params.tenant);
    const now = params.now ?? new Date();
    const items = await this.prisma.auditorAccessGrant.findMany({
      where: {
        company_id: params.tenant.companyId,
        auditor_member_id: params.tenant.membershipId,
        ...activeWindow(now),
      },
      orderBy: [{ expires_at: 'asc' }, { id: 'asc' }],
    });
    return { items: items.map(serializeGrant) };
  }

  async createGrant(params: {
    tenant: TenantContext;
    body: CreateAuditorAccessGrantBody;
    audit: AuditorAccessAuditContext;
  }) {
    requirePermission(params.tenant, 'auditor_grants.manage');
    const startsAt = params.body.startsAt ? new Date(params.body.startsAt) : new Date();
    const expiresAt = new Date(params.body.expiresAt);
    const maxExpiresAt = addDays(startsAt, MAX_GRANT_DAYS);

    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= startsAt) {
      throw new AppError({ statusCode: 422, code: 'INVALID_GRANT_WINDOW', message: 'Auditor grant expiry must be after the start time.' });
    }
    if (expiresAt > maxExpiresAt) {
      throw new AppError({ statusCode: 422, code: 'AUDITOR_GRANT_WINDOW_TOO_LONG', message: 'Auditor access grants cannot exceed 90 days.' });
    }

    const auditorMember = await this.prisma.companyMember.findFirst({
      where: { id: params.body.auditorMemberId, company_id: params.tenant.companyId, status: 'ACTIVE', role: 'AUDITOR' },
    });
    if (!auditorMember) {
      throw new AppError({ statusCode: 404, code: 'AUDITOR_MEMBER_NOT_FOUND', message: 'Active auditor membership was not found.' });
    }

    await this.assertGrantableScope({ tenant: params.tenant, scopeType: params.body.scopeType, scopeId: params.body.scopeId });

    const existing = await this.prisma.auditorAccessGrant.findFirst({
      where: {
        company_id: params.tenant.companyId,
        auditor_member_id: params.body.auditorMemberId,
        scope_type: params.body.scopeType,
        scope_id: params.body.scopeId,
        revoked_at: null,
      },
    });
    if (existing) {
      throw new AppError({ statusCode: 409, code: 'AUDITOR_GRANT_ALREADY_ACTIVE', message: 'An active auditor grant already exists for this scope.' });
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const grant = await tx.auditorAccessGrant.create({
          data: {
            company_id: params.tenant.companyId,
            auditor_member_id: params.body.auditorMemberId,
            scope_type: params.body.scopeType,
            scope_id: params.body.scopeId,
            starts_at: startsAt,
            expires_at: expiresAt,
            download_allowed: params.body.downloadAllowed,
            granted_by_user_id: params.tenant.userId,
          },
        });

        await new AuditLogService(tx).recordEvent({
          tenant: params.tenant,
          sessionId: params.audit.sessionId,
          action: 'AUDITOR_ACCESS_GRANTED',
          entityType: 'auditor_access_grant',
          entityId: grant.id,
          metadata: {
            auditorMemberId: grant.auditor_member_id,
            scopeType: grant.scope_type,
            scopeId: grant.scope_id,
            startsAt: grant.starts_at.toISOString(),
            expiresAt: grant.expires_at.toISOString(),
            downloadAllowed: grant.download_allowed,
          },
          actorSnapshot: { role: params.tenant.role },
          ipAddress: params.audit.ipAddress,
          userAgent: params.audit.userAgent,
          requestId: params.audit.requestId,
        });
        return grant;
      });

      return serializeGrant(created);
    } catch (error) {
      if (isPrismaUniqueConstraintConflict(error)) {
        throw new AppError({ statusCode: 409, code: 'AUDITOR_GRANT_ALREADY_ACTIVE', message: 'An active auditor grant already exists for this scope.' });
      }
      throw error;
    }
  }

  async revokeGrant(params: { tenant: TenantContext; grantId: string; audit: AuditorAccessAuditContext }) {
    requirePermission(params.tenant, 'auditor_grants.manage');
    const grant = await this.prisma.auditorAccessGrant.findFirst({ where: { id: params.grantId, company_id: params.tenant.companyId } });
    if (!grant) throw new AppError({ statusCode: 404, code: 'AUDITOR_GRANT_NOT_FOUND', message: 'Auditor access grant was not found.' });
    if (grant.revoked_at) return serializeGrant(grant);

    const revoked = await this.prisma.$transaction(async (tx) => {
      assertExactlyOneRowUpdated(
        await tx.auditorAccessGrant.updateMany({
          where: { id: grant.id, company_id: params.tenant.companyId, revoked_at: null },
          data: { revoked_at: new Date(), revoked_by_user_id: params.tenant.userId },
        }),
        'Auditor access grant was concurrently revoked before this request could be committed.',
        [{ field: 'expectedRevokedAt', reason: 'null' }],
      );
      const updated = await tx.auditorAccessGrant.findUniqueOrThrow({ where: { id: grant.id } });
      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'AUDITOR_ACCESS_REVOKED',
        entityType: 'auditor_access_grant',
        entityId: updated.id,
        metadata: {
          auditorMemberId: updated.auditor_member_id,
          scopeType: updated.scope_type,
          scopeId: updated.scope_id,
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });
      return updated;
    });
    return serializeGrant(revoked);
  }

  async assertAuditorCanAccessEvidenceItem(params: { tenant: TenantContext; evidenceItemId: string; requireDownload?: boolean }) {
    if (params.tenant.role !== 'AUDITOR') return null;
    const item = await this.prisma.evidenceItem.findFirst({
      where: { id: params.evidenceItemId, company_id: params.tenant.companyId, archived_at: null },
      include: {
        current_approved_version: {
          include: { evidence_control_mappings: { where: { status: 'APPROVED' }, select: { control_id: true } } },
        },
      },
    });
    if (!item?.current_approved_version || item.current_approved_version.status !== 'APPROVED') {
      throw new AppError({ statusCode: 404, code: 'EVIDENCE_NOT_FOUND', message: 'Approved evidence was not found.' });
    }

    const scopes = await this.buildEvidenceVersionGrantScopes({
      tenant: params.tenant,
      evidenceItemId: item.id,
      evidenceVersionId: item.current_approved_version.id,
      mappedControlIds: item.current_approved_version.evidence_control_mappings.map((mapping) => mapping.control_id),
    });
    return this.assertActiveGrant({ tenant: params.tenant, scopes, requireDownload: params.requireDownload });
  }

  async assertAuditorCanAccessEvidenceVersion(params: { tenant: TenantContext; versionId: string; requireDownload?: boolean }) {
    if (params.tenant.role !== 'AUDITOR') return null;
    const version = await this.prisma.evidenceVersion.findFirst({
      where: { id: params.versionId, evidence_item: { company_id: params.tenant.companyId, archived_at: null } },
      include: {
        evidence_item: true,
        evidence_control_mappings: { where: { status: 'APPROVED' }, select: { control_id: true } },
      },
    });
    if (!version || version.status !== 'APPROVED') {
      throw new AppError({ statusCode: 404, code: 'EVIDENCE_VERSION_NOT_FOUND', message: 'Approved evidence version was not found.' });
    }

    const scopes = await this.buildEvidenceVersionGrantScopes({
      tenant: params.tenant,
      evidenceItemId: version.evidence_item_id,
      evidenceVersionId: version.id,
      mappedControlIds: version.evidence_control_mappings.map((mapping) => mapping.control_id),
    });
    return this.assertActiveGrant({ tenant: params.tenant, scopes, requireDownload: params.requireDownload });
  }

  async assertAuditorCanAccessReport(params: { tenant: TenantContext; reportId: string; frameworkEnrollmentId?: string | null; requireDownload?: boolean }) {
    if (params.tenant.role !== 'AUDITOR') return null;
    const scopes: Array<{ scope_type: AuditorScopeType; scope_id: string }> = [{ scope_type: 'REPORT', scope_id: params.reportId }];
    if (params.frameworkEnrollmentId) scopes.push({ scope_type: 'FRAMEWORK', scope_id: params.frameworkEnrollmentId });
    return this.assertActiveGrant({ tenant: params.tenant, scopes, requireDownload: params.requireDownload });
  }

  async getAccessibleEvidenceItemIdsForAuditor(tenant: TenantContext) {
    if (tenant.role !== 'AUDITOR') return null;
    const now = new Date();
    const grants = await this.prisma.auditorAccessGrant.findMany({
      where: { company_id: tenant.companyId, auditor_member_id: tenant.membershipId, ...activeWindow(now) },
    });
    if (grants.length === 0) return [];

    const itemIds = new Set<string>();
    const versionIds = grants.filter((g) => g.scope_type === 'EVIDENCE_VERSION').map((g) => g.scope_id);
    const directItemIds = grants.filter((g) => g.scope_type === 'EVIDENCE_ITEM').map((g) => g.scope_id);
    directItemIds.forEach((id) => itemIds.add(id));

    if (versionIds.length) {
      const versions = await this.prisma.evidenceVersion.findMany({
        where: { id: { in: versionIds }, status: 'APPROVED', evidence_item: { company_id: tenant.companyId, archived_at: null } },
        select: { evidence_item_id: true },
      });
      versions.forEach((version) => itemIds.add(version.evidence_item_id));
    }

    const controlGrantIds = grants.filter((g) => g.scope_type === 'CONTROL').map((g) => g.scope_id);
    const frameworkGrantIds = grants.filter((g) => g.scope_type === 'FRAMEWORK').map((g) => g.scope_id);
    const controls = controlGrantIds.length || frameworkGrantIds.length
      ? await this.prisma.companyControl.findMany({
          where: {
            company_framework: { company_id: tenant.companyId },
            OR: [
              ...(controlGrantIds.length ? [{ id: { in: controlGrantIds } }] : []),
              ...(frameworkGrantIds.length ? [{ company_framework_id: { in: frameworkGrantIds } }] : []),
            ],
          },
          select: { control_id: true },
        })
      : [];
    const controlIds = [...new Set(controls.map((control) => control.control_id))];
    if (controlIds.length) {
      const mappings = await this.prisma.evidenceControlMapping.findMany({
        where: {
          company_id: tenant.companyId,
          control_id: { in: controlIds },
          status: 'APPROVED',
          evidence_version: { status: 'APPROVED', evidence_item: { archived_at: null } },
        },
        select: { evidence_version: { select: { evidence_item_id: true } } },
      });
      mappings.forEach((mapping) => itemIds.add(mapping.evidence_version.evidence_item_id));
    }
    return [...itemIds];
  }

  async getReadableReportIdsForAuditor(tenant: TenantContext) {
    if (tenant.role !== 'AUDITOR') return null;
    const now = new Date();
    const grants = await this.prisma.auditorAccessGrant.findMany({
      where: { company_id: tenant.companyId, auditor_member_id: tenant.membershipId, ...activeWindow(now) },
    });
    const reportIds = new Set(grants.filter((g) => g.scope_type === 'REPORT').map((g) => g.scope_id));
    const frameworkIds = grants.filter((g) => g.scope_type === 'FRAMEWORK').map((g) => g.scope_id);
    if (frameworkIds.length) {
      const reports = await this.prisma.report.findMany({
        where: { company_id: tenant.companyId, framework_enrollment_id: { in: frameworkIds }, status: 'COMPLETED' },
        select: { id: true },
      });
      reports.forEach((report) => reportIds.add(report.id));
    }
    return [...reportIds];
  }


  async listAuditorViewControls(params: { tenant: TenantContext; query: AuditorViewListQuery }) {
    requirePermission(params.tenant, 'auditor_grants.read');
    this.assertAuditorRole(params.tenant);
    const now = new Date();
    const grants = await this.prisma.auditorAccessGrant.findMany({
      where: { company_id: params.tenant.companyId, auditor_member_id: params.tenant.membershipId, ...activeWindow(now) },
    });
    if (grants.length === 0) return this.paginated([], 0, params.query);

    const frameworkGrantIds = grants.filter((grant) => grant.scope_type === 'FRAMEWORK').map((grant) => grant.scope_id);
    const directControlGrantIds = grants.filter((grant) => grant.scope_type === 'CONTROL').map((grant) => grant.scope_id);
    const evidenceItemGrantIds = grants.filter((grant) => grant.scope_type === 'EVIDENCE_ITEM').map((grant) => grant.scope_id);
    const evidenceVersionGrantIds = grants.filter((grant) => grant.scope_type === 'EVIDENCE_VERSION').map((grant) => grant.scope_id);

    const controlIdsFromEvidence = evidenceItemGrantIds.length || evidenceVersionGrantIds.length
      ? await this.prisma.evidenceControlMapping.findMany({
          where: {
            company_id: params.tenant.companyId,
            status: 'APPROVED',
            evidence_version: {
              status: 'APPROVED',
              evidence_item: {
                company_id: params.tenant.companyId,
                archived_at: null,
                OR: [
                  ...(evidenceItemGrantIds.length ? [{ id: { in: evidenceItemGrantIds } }] : []),
                  ...(evidenceVersionGrantIds.length ? [{ versions: { some: { id: { in: evidenceVersionGrantIds }, status: 'APPROVED' } } }] : []),
                ],
              },
            },
          },
          select: { control_id: true },
        })
      : [];

    const controlTemplateIds = [...new Set(controlIdsFromEvidence.map((mapping) => mapping.control_id))];
    const where = {
      company_framework: { company_id: params.tenant.companyId },
      OR: [
        ...(directControlGrantIds.length ? [{ id: { in: directControlGrantIds } }] : []),
        ...(frameworkGrantIds.length ? [{ company_framework_id: { in: frameworkGrantIds } }] : []),
        ...(controlTemplateIds.length ? [{ control_id: { in: controlTemplateIds } }] : []),
      ],
    };
    if (!where.OR.length) return this.paginated([], 0, params.query);
    const skip = (params.query.page - 1) * params.query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.companyControl.findMany({
        where,
        include: {
          company_framework: { include: { framework: true, framework_version: true } },
          control: { include: { evidence_requirements: { orderBy: { sort_order: 'asc' } } } },
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ company_framework_id: 'asc' }, { control: { sort_order: 'asc' } }, { id: 'asc' }],
        skip,
        take: params.query.limit,
      }),
      this.prisma.companyControl.count({ where }),
    ]);
    return this.paginated(items.map((item) => ({
      id: item.id,
      frameworkEnrollmentId: item.company_framework_id,
      framework: {
        id: item.company_framework.framework.id,
        name: item.company_framework.framework.name,
        version: item.company_framework.framework_version.version,
      },
      control: {
        id: item.control.id,
        code: item.control.code,
        title: item.control.title,
        description: item.control.description,
        riskLevel: item.control.risk_level,
        controlType: item.control.control_type,
      },
      applicability: item.applicability,
      owner: item.owner ? { id: item.owner.id, name: item.owner.name, email: item.owner.email } : null,
      requiredEvidenceRequirements: item.control.evidence_requirements
        .filter((requirement) => requirement.required)
        .map((requirement) => ({ id: requirement.id, code: requirement.code, name: requirement.name })),
    })), total, params.query);
  }

  async listAuditorViewEvidence(params: { tenant: TenantContext; query: AuditorViewListQuery }) {
    requirePermission(params.tenant, 'evidence.read');
    this.assertAuditorRole(params.tenant);
    const allowedEvidenceItemIds = await this.getAccessibleEvidenceItemIdsForAuditor(params.tenant);
    if (!allowedEvidenceItemIds || allowedEvidenceItemIds.length === 0) return this.paginated([], 0, params.query);
    const skip = (params.query.page - 1) * params.query.limit;
    const where = {
      company_id: params.tenant.companyId,
      archived_at: null,
      id: { in: allowedEvidenceItemIds },
      current_approved_version_id: { not: null },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.evidenceItem.findMany({
        where,
        include: {
          current_approved_version: {
            include: {
              evidence_control_mappings: {
                where: { status: 'APPROVED' },
                include: { control: true, requirement: true },
              },
            },
          },
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip,
        take: params.query.limit,
      }),
      this.prisma.evidenceItem.count({ where }),
    ]);
    return this.paginated(items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      sensitivityLevel: item.sensitivity_level,
      currentApprovedVersion: item.current_approved_version ? {
        id: item.current_approved_version.id,
        versionNo: item.current_approved_version.version_no,
        fileName: item.current_approved_version.file_name,
        mimeType: item.current_approved_version.mime_type,
        fileSize: item.current_approved_version.file_size,
        sha256Checksum: item.current_approved_version.sha256_checksum,
        status: item.current_approved_version.status,
        effectiveFrom: item.current_approved_version.effective_from ? iso(item.current_approved_version.effective_from) : null,
        effectiveUntil: item.current_approved_version.effective_until ? iso(item.current_approved_version.effective_until) : null,
        expiryDate: item.current_approved_version.expiry_date ? iso(item.current_approved_version.expiry_date) : null,
        mappings: item.current_approved_version.evidence_control_mappings.map((mapping) => ({
          id: mapping.id,
          controlId: mapping.control_id,
          controlCode: mapping.control.code,
          controlTitle: mapping.control.title,
          requirementId: mapping.requirement_id,
          requirementCode: mapping.requirement?.code ?? null,
          requirementName: mapping.requirement?.name ?? null,
        })),
      } : null,
    })), total, params.query);
  }

  async listAuditorViewReports(params: { tenant: TenantContext; query: AuditorViewListQuery }) {
    requirePermission(params.tenant, 'reports.read_selected');
    this.assertAuditorRole(params.tenant);
    const reportIds = await this.getReadableReportIdsForAuditor(params.tenant);
    if (!reportIds || reportIds.length === 0) return this.paginated([], 0, params.query);
    const skip = (params.query.page - 1) * params.query.limit;
    const where = { company_id: params.tenant.companyId, id: { in: reportIds }, status: 'COMPLETED' as const };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip,
        take: params.query.limit,
      }),
      this.prisma.report.count({ where }),
    ]);
    return this.paginated(items.map((report) => ({
      id: report.id,
      type: report.type,
      format: report.format,
      schemaVersion: report.schema_version,
      frameworkEnrollmentId: report.framework_enrollment_id,
      frameworkVersionId: report.framework_version_id,
      calculatedAt: report.calculated_at ? iso(report.calculated_at) : null,
      status: report.status,
      fileName: report.file_name,
      contentType: report.content_type,
      completedAt: report.completed_at ? iso(report.completed_at) : null,
      expiresAt: report.expires_at ? iso(report.expires_at) : null,
    })), total, params.query);
  }

  async recordAuditorSensitiveDownload(params: {
    tenant: TenantContext;
    resourceType: 'evidence_version' | 'report';
    resourceId: string;
    scopeType: AuditorScopeType;
    scopeId: string;
    auditorAccessGrantId?: string;
    audit: AuditorAccessAuditContext;
  }) {
    if (params.tenant.role !== 'AUDITOR') return;
    await new AuditLogService(this.prisma).recordEvent({
      tenant: params.tenant,
      sessionId: params.audit.sessionId,
      action: 'AUDITOR_ACCESS_USED',
      entityType: params.resourceType,
      entityId: params.resourceId,
      metadata: {
        scopeType: params.scopeType,
        scopeId: params.scopeId,
        auditorAccessGrantId: params.auditorAccessGrantId,
        use: 'sensitive_download',
      },
      actorSnapshot: { role: params.tenant.role },
      ipAddress: params.audit.ipAddress,
      userAgent: params.audit.userAgent,
      requestId: params.audit.requestId,
    });
  }

  private assertAuditorRole(tenant: TenantContext) {
    if (tenant.role !== 'AUDITOR') {
      throw new AppError({ statusCode: 403, code: 'AUDITOR_ROLE_REQUIRED', message: 'This endpoint is only for auditor read-only views.' });
    }
  }

  private paginated<T>(items: T[], total: number, query: AuditorViewListQuery) {
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  private async buildEvidenceVersionGrantScopes(params: {
    tenant: TenantContext;
    evidenceItemId: string;
    evidenceVersionId: string;
    mappedControlIds: string[];
  }): Promise<Array<{ scope_type: AuditorScopeType; scope_id: string }>> {
    const directScopes: Array<{ scope_type: AuditorScopeType; scope_id: string }> = [
      { scope_type: 'EVIDENCE_VERSION', scope_id: params.evidenceVersionId },
      { scope_type: 'EVIDENCE_ITEM', scope_id: params.evidenceItemId },
    ];
    const controlIds = [...new Set(params.mappedControlIds)];
    if (!controlIds.length) return directScopes;

    const companyControls = await this.prisma.companyControl.findMany({
      where: { control_id: { in: controlIds }, company_framework: { company_id: params.tenant.companyId } },
      select: { id: true, company_framework_id: true },
    });
    return [
      ...directScopes,
      ...companyControls.map((control) => ({ scope_type: 'CONTROL' as const, scope_id: control.id })),
      ...companyControls.map((control) => ({ scope_type: 'FRAMEWORK' as const, scope_id: control.company_framework_id })),
    ];
  }

  private async assertActiveGrant(params: {
    tenant: TenantContext;
    scopes: Array<{ scope_type: AuditorScopeType; scope_id: string }>;
    requireDownload?: boolean;
  }) {
    if (params.scopes.length === 0) {
      throw new AppError({ statusCode: 403, code: 'AUDITOR_GRANT_REQUIRED', message: 'An active auditor access grant is required.' });
    }
    const now = new Date();
    const grant = await this.prisma.auditorAccessGrant.findFirst({
      where: {
        company_id: params.tenant.companyId,
        auditor_member_id: params.tenant.membershipId,
        ...activeWindow(now),
        OR: params.scopes,
        ...(params.requireDownload ? { download_allowed: true } : {}),
      },
      orderBy: [{ scope_type: 'desc' }, { expires_at: 'asc' }, { id: 'asc' }],
    });
    if (!grant) {
      throw new AppError({
        statusCode: 403,
        code: params.requireDownload ? 'AUDITOR_DOWNLOAD_GRANT_REQUIRED' : 'AUDITOR_GRANT_REQUIRED',
        message: 'An active auditor access grant is required for this resource.',
      });
    }
    return grant;
  }

  private async assertGrantableScope(params: { tenant: TenantContext; scopeType: AuditorScopeType; scopeId: string }) {
    if (params.scopeType === 'FRAMEWORK') {
      const exists = await this.prisma.companyFramework.findFirst({ where: { id: params.scopeId, company_id: params.tenant.companyId } });
      if (!exists) throw new AppError({ statusCode: 404, code: 'AUDITOR_SCOPE_NOT_FOUND', message: 'Framework enrollment scope was not found.' });
      return;
    }
    if (params.scopeType === 'CONTROL') {
      const exists = await this.prisma.companyControl.findFirst({ where: { id: params.scopeId, company_framework: { company_id: params.tenant.companyId } } });
      if (!exists) throw new AppError({ statusCode: 404, code: 'AUDITOR_SCOPE_NOT_FOUND', message: 'Control scope was not found.' });
      return;
    }
    if (params.scopeType === 'EVIDENCE_ITEM') {
      const exists = await this.prisma.evidenceItem.findFirst({ where: { id: params.scopeId, company_id: params.tenant.companyId, archived_at: null, current_approved_version_id: { not: null } } });
      if (!exists) throw new AppError({ statusCode: 404, code: 'AUDITOR_SCOPE_NOT_FOUND', message: 'Approved evidence item scope was not found.' });
      return;
    }
    if (params.scopeType === 'EVIDENCE_VERSION') {
      const exists = await this.prisma.evidenceVersion.findFirst({ where: { id: params.scopeId, status: 'APPROVED', evidence_item: { company_id: params.tenant.companyId, archived_at: null } } });
      if (!exists) throw new AppError({ statusCode: 404, code: 'AUDITOR_SCOPE_NOT_FOUND', message: 'Approved evidence version scope was not found.' });
      return;
    }
    const exists = await this.prisma.report.findFirst({ where: { id: params.scopeId, company_id: params.tenant.companyId, status: 'COMPLETED' } });
    if (!exists) throw new AppError({ statusCode: 404, code: 'AUDITOR_SCOPE_NOT_FOUND', message: 'Completed report scope was not found.' });
  }
}
