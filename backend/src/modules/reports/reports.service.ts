import type { Prisma, PrismaClient } from '@prisma/client';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import { AuditorAccessService } from '../auditor-access/auditor-access.service.js';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { AppError } from '../../shared/errors.js';
import { isPrismaUniqueConstraintConflict, normalizeIdempotencyKey } from '../../shared/concurrency.js';
import { requirePermission } from '../authz/permissions.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { GenerateReportBody, ReportListQuery, ReportType } from './report.schemas.js';
import { toCsv } from './report-csv.js';
import {
  AUDIT_READINESS_CSV_HEADERS_V1,
  CONTROL_COVERAGE_CSV_HEADERS_V1,
  EVIDENCE_INVENTORY_CSV_HEADERS_V1,
  MISSING_EVIDENCE_CSV_HEADERS_V1,
  REPORT_LANGUAGE_BOUNDARY_V1,
  REPORT_SCHEMA_VERSION_V1,
  assertAuditReadinessReportV1,
  assertControlCoverageReportV1,
  assertEvidenceInventoryReportV1,
  assertMissingEvidenceReportV1,
  baseReportFieldsV1,
  type ApprovedEvidenceReferenceV1,
} from './schemas/index.js';

export type ReportAuditContext = {
  requestId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
};

const SCHEMA_VERSION = REPORT_SCHEMA_VERSION_V1;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function iso(value?: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function reportFileName(type: ReportType, format: 'JSON' | 'CSV', now: Date): string {
  const stamp = now.toISOString().slice(0, 10);
  return `${type.toLowerCase()}_${stamp}.${format.toLowerCase()}`;
}

function contentType(format: 'JSON' | 'CSV'): string {
  return format === 'JSON' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8';
}

function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export class ReportsService {
  constructor(private readonly prisma: PrismaClient) {}

  async generateReport(params: {
    tenant: TenantContext;
    body: GenerateReportBody;
    idempotencyKey?: string;
    audit: ReportAuditContext;
  }) {
    requirePermission(params.tenant, 'reports.generate');

    const idempotencyKey = normalizeIdempotencyKey(params.idempotencyKey);

    // Idempotency-Key replay support: scope is company + user + key.
    if (idempotencyKey) {
      const replay = await this.prisma.report.findFirst({
        where: {
          company_id: params.tenant.companyId,
          generated_by_user_id: params.tenant.userId,
          idempotency_key: idempotencyKey,
        },
      });
      if (replay) return this.serializeReport(replay);
    }

    const now = new Date();
    const { content, rows, headers, enrollment } = await this.buildReportContent({ tenant: params.tenant, body: params.body, now });
    const text = params.body.format === 'JSON' ? stringifyJson(content) : toCsv(rows, headers);
    const filename = reportFileName(params.body.type, params.body.format, now);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const report = await tx.report.create({
          data: {
            company_id: params.tenant.companyId,
            generated_by_user_id: params.tenant.userId,
            type: params.body.type,
            format: params.body.format,
            idempotency_key: idempotencyKey,
            schema_version: SCHEMA_VERSION,
            parameters_json: {
              type: params.body.type,
              format: params.body.format,
              companyFrameworkId: params.body.companyFrameworkId ?? null,
              expiringDays: params.body.expiringDays,
              languageBoundary: REPORT_LANGUAGE_BOUNDARY_V1,
              languageBoundaryNote: 'not certification or legal compliance',
            },
            framework_enrollment_id: enrollment?.id ?? null,
            framework_version_id: enrollment?.framework_version_id ?? null,
            calculated_at: now,
            status: 'COMPLETED',
            content_json: params.body.format === 'JSON' ? (content as Prisma.InputJsonValue) : undefined,
            content_text: text,
            content_type: contentType(params.body.format),
            file_name: filename,
            completed_at: now,
            expires_at: addDays(now, 90),
          },
        });

        await new AuditLogService(tx).recordEvent({
          tenant: params.tenant,
          sessionId: params.audit.sessionId,
          action: 'REPORT_GENERATED',
          entityType: 'report',
          entityId: report.id,
          metadata: {
            type: report.type,
            format: report.format,
            schemaVersion: report.schema_version,
            frameworkEnrollmentId: report.framework_enrollment_id,
            frameworkVersionId: report.framework_version_id,
            parameters: report.parameters_json,
          },
          actorSnapshot: { role: params.tenant.role },
          ipAddress: params.audit.ipAddress,
          userAgent: params.audit.userAgent,
          requestId: params.audit.requestId,
        });

        return report;
      });

      return this.serializeReport(created);
    } catch (error) {
      if (idempotencyKey && isPrismaUniqueConstraintConflict(error)) {
        const replay = await this.prisma.report.findFirstOrThrow({
          where: { company_id: params.tenant.companyId, generated_by_user_id: params.tenant.userId, idempotency_key: idempotencyKey },
        });
        return this.serializeReport(replay);
      }
      throw error;
    }
  }

  async listReports(params: { tenant: TenantContext; query: ReportListQuery }) {
    const accessibleReportIds = await new AuditorAccessService(this.prisma).getReadableReportIdsForAuditor(params.tenant);
    if (accessibleReportIds) {
      requirePermission(params.tenant, 'reports.read_selected');
    } else {
      requirePermission(params.tenant, 'reports.generate');
    }
    const skip = (params.query.page - 1) * params.query.limit;
    const where = {
      company_id: params.tenant.companyId,
      ...(accessibleReportIds ? { id: { in: accessibleReportIds }, status: 'COMPLETED' as const } : {}),
      ...(params.query.type ? { type: params.query.type } : {}),
      ...(!accessibleReportIds && params.query.status ? { status: params.query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip,
        take: params.query.limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      items: items.map((item) => this.serializeReport(item)),
      pagination: {
        page: params.query.page,
        limit: params.query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.query.limit)),
      },
    };
  }

  async getReport(params: { tenant: TenantContext; reportId: string }) {
    if (params.tenant.role === 'AUDITOR') {
      requirePermission(params.tenant, 'reports.read_selected');
    } else {
      requirePermission(params.tenant, 'reports.generate');
    }
    const report = await this.findReportInTenantScope(params);
    if (params.tenant.role === 'AUDITOR' && report.status !== 'COMPLETED') {
      throw new AppError({ statusCode: 404, code: 'REPORT_NOT_FOUND', message: 'Completed report was not found.' });
    }
    await new AuditorAccessService(this.prisma).assertAuditorCanAccessReport({
      tenant: params.tenant,
      reportId: report.id,
      frameworkEnrollmentId: report.framework_enrollment_id,
    });
    return this.serializeReport(report);
  }

  async downloadReport(params: { tenant: TenantContext; reportId: string; audit: ReportAuditContext }) {
    if (params.tenant.role === 'AUDITOR') {
      requirePermission(params.tenant, 'reports.read_selected');
    } else {
      requirePermission(params.tenant, 'reports.generate');
    }
    const report = await this.findReportInTenantScope(params);
    if (params.tenant.role === 'AUDITOR' && report.status !== 'COMPLETED') {
      throw new AppError({ statusCode: 404, code: 'REPORT_NOT_FOUND', message: 'Completed report was not found.' });
    }
    const auditorGrant = await new AuditorAccessService(this.prisma).assertAuditorCanAccessReport({
      tenant: params.tenant,
      reportId: report.id,
      frameworkEnrollmentId: report.framework_enrollment_id,
      requireDownload: true,
    });
    if (report.status !== 'COMPLETED' || !report.content_text || !report.content_type || !report.file_name) {
      throw new AppError({ statusCode: 409, code: 'REPORT_NOT_READY', message: 'Report is not ready for download.' });
    }

    await new AuditLogService(this.prisma).recordEvent({
      tenant: params.tenant,
      sessionId: params.audit.sessionId,
      action: 'REPORT_DOWNLOADED',
      entityType: 'report',
      entityId: report.id,
      metadata: {
        type: report.type,
        format: report.format,
        schemaVersion: report.schema_version,
        auditorAccessUsed: params.tenant.role === 'AUDITOR',
      },
      actorSnapshot: { role: params.tenant.role },
      ipAddress: params.audit.ipAddress,
      userAgent: params.audit.userAgent,
      requestId: params.audit.requestId,
    });
    await new AuditorAccessService(this.prisma).recordAuditorSensitiveDownload({
      tenant: params.tenant,
      resourceType: 'report',
      resourceId: report.id,
      scopeType: auditorGrant?.scope_type ?? 'REPORT',
      scopeId: auditorGrant?.scope_id ?? report.id,
      auditorAccessGrantId: auditorGrant?.id,
      audit: params.audit,
    });

    return {
      fileName: report.file_name,
      contentType: report.content_type,
      body: report.content_text,
    };
  }

  private async findReportInTenantScope(params: { tenant: TenantContext; reportId: string }) {
    const report = await this.prisma.report.findFirst({
      where: { id: params.reportId, company_id: params.tenant.companyId },
    });
    if (!report) {
      throw new AppError({ statusCode: 404, code: 'REPORT_NOT_FOUND', message: 'Report was not found.' });
    }
    return report;
  }

  private async getCompany(companyId: string) {
    return this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { id: true, name: true, industry: true, website: true },
    });
  }

  private async getEnrollment(params: { tenant: TenantContext; companyFrameworkId?: string }) {
    const enrollment = await this.prisma.companyFramework.findFirst({
      where: {
        company_id: params.tenant.companyId,
        status: 'ACTIVE',
        ...(params.companyFrameworkId ? { id: params.companyFrameworkId } : {}),
      },
      orderBy: [{ started_at: 'desc' }, { id: 'desc' }],
      include: {
        framework: { select: { id: true, name: true } },
        framework_version: { select: { id: true, version: true } },
      },
    });
    if (params.companyFrameworkId && !enrollment) {
      throw new AppError({ statusCode: 404, code: 'COMPANY_FRAMEWORK_NOT_FOUND', message: 'Active framework enrollment was not found.' });
    }
    return enrollment;
  }

  private async buildReportContent(params: { tenant: TenantContext; body: GenerateReportBody; now: Date }) {
    const company = await this.getCompany(params.tenant.companyId);
    const enrollment = await this.getEnrollment({ tenant: params.tenant, companyFrameworkId: params.body.companyFrameworkId });
    const base = baseReportFieldsV1({
      reportType: params.body.type,
      generatedAt: params.now.toISOString(),
      calculatedAt: params.now.toISOString(),
      company,
      framework: enrollment
        ? {
            companyFrameworkId: enrollment.id,
            frameworkId: enrollment.framework_id,
            frameworkName: enrollment.framework.name,
            frameworkVersionId: enrollment.framework_version_id,
            frameworkVersion: enrollment.framework_version.version,
            targetAuditDate: iso(enrollment.target_audit_date),
          }
        : null,
      parameters: {
        companyFrameworkId: params.body.companyFrameworkId ?? null,
        expiringDays: params.body.expiringDays,
      },
    });

    if (params.body.type === 'AUDIT_READINESS') {
      const dashboard = new DashboardService(this.prisma);
      const overview = await dashboard.getOverview({ tenant: params.tenant, query: { companyFrameworkId: params.body.companyFrameworkId, expiringDays: params.body.expiringDays } });
      const controlProgress = await dashboard.getControlProgress({ tenant: params.tenant, query: { companyFrameworkId: params.body.companyFrameworkId, expiringDays: params.body.expiringDays } });
      const missing = await dashboard.getMissingEvidence({ tenant: params.tenant, query: { companyFrameworkId: params.body.companyFrameworkId, expiringDays: params.body.expiringDays } });
      const expiring = await dashboard.getExpiringEvidence({ tenant: params.tenant, query: { companyFrameworkId: params.body.companyFrameworkId, expiringDays: params.body.expiringDays } });
      const openTasks = await this.listOpenTasks({ tenant: params.tenant, companyFrameworkId: params.body.companyFrameworkId });
      const evidenceReferencesByControl = await this.listApprovedEvidenceReferencesByControl({
        tenant: params.tenant,
        controlIds: controlProgress.controls.map((control) => control.controlId),
        now: params.now,
      });
      const owners = this.groupOwners(controlProgress.controls);
      const content = assertAuditReadinessReportV1({
        ...base,
        reportType: 'AUDIT_READINESS',
        targetAuditDate: base.framework?.targetAuditDate ?? null,
        readinessStatus: overview.readinessStatus,
        readinessPercent: overview.readinessPercent,
        controlCoverage: controlProgress.controls.map((control) => ({
          ...control,
          approvedEvidenceReferences: evidenceReferencesByControl.get(control.controlId) ?? [],
        })),
        owners,
        missingRequirements: missing.items,
        expiringEvidence: expiring.items,
        openTasks,
      });
      const rows = controlProgress.controls.map((control) => ({
        schemaVersion: SCHEMA_VERSION,
        reportType: params.body.type,
        generatedAt: base.generatedAt,
        companyId: company.id,
        companyFrameworkId: base.framework?.companyFrameworkId ?? '',
        frameworkVersionId: base.framework?.frameworkVersionId ?? '',
        targetAuditDate: base.framework?.targetAuditDate ?? '',
        readinessStatus: overview.readinessStatus,
        readinessPercent: overview.readinessPercent,
        controlCode: control.code,
        controlTitle: control.title,
        riskLevel: control.riskLevel,
        ownerUserId: control.ownerUserId ?? '',
        requiredCount: control.requiredCount,
        satisfiedCount: control.satisfiedCount,
        coveragePercent: control.coveragePercent,
        readinessState: control.readinessState,
        missingRequirementCount: control.requirements.filter((requirement) => !requirement.satisfied).length,
        approvedEvidenceReferenceCount: evidenceReferencesByControl.get(control.controlId)?.length ?? 0,
        openTaskCount: openTasks.filter((task) => task.controlId === control.controlId).length,
      }));
      return { content, rows, headers: [...AUDIT_READINESS_CSV_HEADERS_V1], enrollment };
    }

    if (params.body.type === 'MISSING_EVIDENCE') {
      const missing = await new DashboardService(this.prisma).getMissingEvidence({ tenant: params.tenant, query: { companyFrameworkId: params.body.companyFrameworkId, expiringDays: params.body.expiringDays } });
      const tasksByRequirement = await this.listOpenTasksByRequirement({
        tenant: params.tenant,
        requirementIds: missing.items.map((item) => item.requirementId),
      });
      const missingEvidence = missing.items.map((item) => {
        const task = tasksByRequirement.get(item.requirementId)?.[0] ?? null;
        return {
          ...item,
          satisfactionStatus: 'MISSING_VALID_APPROVED_EVIDENCE' as const,
          taskStatus: task?.status ?? null,
          taskDueDate: task?.dueDate ?? null,
          taskId: task?.id ?? null,
        };
      });
      const content = assertMissingEvidenceReportV1({ ...base, reportType: 'MISSING_EVIDENCE', readinessStatus: missing.readinessStatus, missingEvidence });
      const rows = missingEvidence.map((item) => ({
        schemaVersion: SCHEMA_VERSION,
        reportType: params.body.type,
        generatedAt: base.generatedAt,
        companyId: company.id,
        companyFrameworkId: base.framework?.companyFrameworkId ?? '',
        frameworkVersionId: base.framework?.frameworkVersionId ?? '',
        controlId: item.controlId,
        controlCode: item.controlCode,
        controlTitle: item.controlTitle,
        requirementId: item.requirementId,
        requirementCode: item.requirementCode,
        requirementName: item.requirementName,
        riskLevel: item.riskLevel,
        ownerUserId: item.ownerUserId ?? '',
        satisfactionStatus: item.satisfactionStatus,
        taskStatus: item.taskStatus ?? '',
        taskDueDate: item.taskDueDate ?? '',
        taskId: item.taskId ?? '',
      }));
      return { content, rows, headers: [...MISSING_EVIDENCE_CSV_HEADERS_V1], enrollment };
    }

    if (params.body.type === 'CONTROL_COVERAGE') {
      const progress = await new DashboardService(this.prisma).getControlProgress({ tenant: params.tenant, query: { companyFrameworkId: params.body.companyFrameworkId, expiringDays: params.body.expiringDays } });
      const evidenceReferencesByControl = await this.listApprovedEvidenceReferencesByControl({
        tenant: params.tenant,
        controlIds: progress.controls.map((control) => control.controlId),
        now: params.now,
      });
      const controls = progress.controls.map((control) => ({
        controlId: control.controlId,
        companyControlId: control.companyControlId,
        controlCode: control.code,
        controlTitle: control.title,
        riskLevel: control.riskLevel,
        applicability: 'APPLICABLE' as const,
        requiredCount: control.requiredCount,
        satisfiedCount: control.satisfiedCount,
        coveragePercent: control.coveragePercent,
        readinessState: control.readinessState,
        approvedEvidenceReferences: evidenceReferencesByControl.get(control.controlId) ?? [],
      }));
      const content = assertControlCoverageReportV1({
        ...base,
        reportType: 'CONTROL_COVERAGE',
        readinessStatus: progress.readinessStatus,
        readinessPercent: progress.readinessPercent,
        controls,
      });
      const rows = controls.map((control) => ({
        schemaVersion: SCHEMA_VERSION,
        reportType: params.body.type,
        generatedAt: base.generatedAt,
        companyId: company.id,
        companyFrameworkId: base.framework?.companyFrameworkId ?? '',
        frameworkVersionId: base.framework?.frameworkVersionId ?? '',
        controlId: control.controlId,
        companyControlId: control.companyControlId,
        controlCode: control.controlCode,
        controlTitle: control.controlTitle,
        riskLevel: control.riskLevel,
        applicability: control.applicability,
        requiredCount: control.requiredCount,
        satisfiedCount: control.satisfiedCount,
        coveragePercent: control.coveragePercent,
        readinessState: control.readinessState,
        approvedEvidenceReferences: control.approvedEvidenceReferences.map((ref) => ref.storageReference).join(';'),
      }));
      return { content, rows, headers: [...CONTROL_COVERAGE_CSV_HEADERS_V1], enrollment };
    }

    const inventory = await this.listEvidenceInventory(params.tenant);
    const content = assertEvidenceInventoryReportV1({ ...base, reportType: 'EVIDENCE_INVENTORY', evidenceInventory: inventory });
    const rows = inventory.map((row) => ({
      schemaVersion: SCHEMA_VERSION,
      reportType: params.body.type,
      generatedAt: base.generatedAt,
      companyId: company.id,
      evidenceItemId: row.evidenceItemId,
      evidenceTitle: row.evidenceTitle,
      evidenceVersionId: row.evidenceVersionId,
      versionNo: row.versionNo,
      status: row.status,
      sensitivity: row.sensitivity,
      effectiveFrom: row.dates.effectiveFrom,
      effectiveUntil: row.dates.effectiveUntil,
      expiryDate: row.dates.expiryDate,
      uploadedAt: row.dates.uploadedAt,
      reviewedAt: row.dates.reviewedAt,
      uploaderUserId: row.uploaderUserId,
      reviewerUserId: row.reviewerUserId ?? '',
      checksum: row.checksum,
      storageReference: row.storageReference,
      mappings: row.mappingsSummary,
    }));
    return { content, rows, headers: [...EVIDENCE_INVENTORY_CSV_HEADERS_V1], enrollment };
  }

  private async listEvidenceInventory(tenant: TenantContext) {
    const versions = await this.prisma.evidenceVersion.findMany({
      where: { evidence_item: { company_id: tenant.companyId } },
      orderBy: [{ evidence_item: { title: 'asc' } }, { version_no: 'desc' }],
      include: {
        evidence_item: true,
        reviews: { orderBy: { created_at: 'desc' }, take: 1, select: { reviewer_user_id: true, decision: true, created_at: true } },
        evidence_control_mappings: {
          include: {
            control: { select: { code: true, title: true } },
            requirement: { select: { code: true, name: true } },
          },
        },
      },
    });

    return versions.map((version) => {
      const latestReview = version.reviews[0] ?? null;
      const mappings = version.evidence_control_mappings.map((mapping) => ({
        id: mapping.id,
        status: mapping.status,
        source: mapping.source,
        controlCode: mapping.control.code,
        controlTitle: mapping.control.title,
        requirementCode: mapping.requirement?.code ?? null,
        requirementName: mapping.requirement?.name ?? null,
      }));
      return {
        evidenceItemId: version.evidence_item.id,
        evidenceTitle: version.evidence_item.title,
        evidenceVersionId: version.id,
        versionNo: version.version_no,
        status: version.status,
        sensitivity: version.evidence_item.sensitivity_level,
        dates: {
          effectiveFrom: iso(version.effective_from),
          effectiveUntil: iso(version.effective_until),
          expiryDate: iso(version.expiry_date),
          uploadedAt: version.created_at.toISOString(),
          reviewedAt: iso(latestReview?.created_at),
        },
        uploaderUserId: version.uploaded_by_user_id,
        reviewerUserId: latestReview?.reviewer_user_id ?? null,
        checksum: version.sha256_checksum,
        storageReference: `evidence_version:${version.id}`,
        mappings,
        mappingsSummary: mappings.map((mapping) => `${mapping.status}:${mapping.controlCode}${mapping.requirementCode ? `/${mapping.requirementCode}` : ''}`).join(';'),
      };
    });
  }

  private async listOpenTasks(params: { tenant: TenantContext; companyFrameworkId?: string }) {
    const tasks = await this.prisma.task.findMany({
      where: {
        company_id: params.tenant.companyId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        ...(params.companyFrameworkId ? { company_control: { company_framework_id: params.companyFrameworkId } } : {}),
      },
      orderBy: [{ due_date: 'asc' }, { id: 'asc' }],
      take: 500,
      select: {
        id: true,
        title: true,
        status: true,
        due_date: true,
        assigned_to_user_id: true,
        requirement_id: true,
        company_control: {
          select: {
            control_id: true,
            control: { select: { code: true, title: true } },
          },
        },
      },
    });
    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: iso(task.due_date),
      assignedToUserId: task.assigned_to_user_id,
      requirementId: task.requirement_id,
      controlId: task.company_control.control_id,
      controlCode: task.company_control.control.code,
      controlTitle: task.company_control.control.title,
    }));
  }

  private async listOpenTasksByRequirement(params: { tenant: TenantContext; requirementIds: string[] }) {
    const uniqueRequirementIds = [...new Set(params.requirementIds)].filter(Boolean);
    const map = new Map<string, Array<{ id: string; status: string; dueDate: string | null }>>();
    if (uniqueRequirementIds.length === 0) return map;
    const tasks = await this.prisma.task.findMany({
      where: {
        company_id: params.tenant.companyId,
        requirement_id: { in: uniqueRequirementIds },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      orderBy: [{ due_date: 'asc' }, { id: 'asc' }],
      select: { id: true, requirement_id: true, status: true, due_date: true },
    });
    for (const task of tasks) {
      if (!task.requirement_id) continue;
      const current = map.get(task.requirement_id) ?? [];
      current.push({ id: task.id, status: task.status, dueDate: iso(task.due_date) });
      map.set(task.requirement_id, current);
    }
    return map;
  }

  private async listApprovedEvidenceReferencesByControl(params: { tenant: TenantContext; controlIds: string[]; now: Date }) {
    const map = new Map<string, ApprovedEvidenceReferenceV1[]>();
    const uniqueControlIds = [...new Set(params.controlIds)].filter(Boolean);
    if (uniqueControlIds.length === 0) return map;
    const mappings = await this.prisma.evidenceControlMapping.findMany({
      where: {
        company_id: params.tenant.companyId,
        control_id: { in: uniqueControlIds },
        status: 'APPROVED',
        evidence_version: {
          status: 'APPROVED',
          evidence_item: { archived_at: null },
        },
      },
      orderBy: [{ control_id: 'asc' }, { requirement_id: 'asc' }, { id: 'asc' }],
      include: {
        requirement: { select: { id: true, code: true } },
        evidence_version: {
          select: {
            id: true,
            version_no: true,
            expiry_date: true,
            effective_from: true,
            effective_until: true,
            evidence_item: { select: { id: true, title: true } },
          },
        },
      },
    });
    for (const mapping of mappings) {
      const version = mapping.evidence_version;
      if (version.expiry_date && version.expiry_date.getTime() < params.now.getTime()) continue;
      if (version.effective_from && version.effective_from.getTime() > params.now.getTime()) continue;
      if (version.effective_until && version.effective_until.getTime() < params.now.getTime()) continue;
      const current = map.get(mapping.control_id) ?? [];
      current.push({
        evidenceItemId: version.evidence_item.id,
        evidenceVersionId: version.id,
        requirementId: mapping.requirement?.id ?? null,
        requirementCode: mapping.requirement?.code ?? null,
        evidenceTitle: version.evidence_item.title,
        versionNo: version.version_no,
        storageReference: `evidence_version:${version.id}`,
      });
      map.set(mapping.control_id, current);
    }
    return map;
  }

  private groupOwners(controls: Array<{ controlId: string; code: string; ownerUserId: string | null }>) {
    const map = new Map<string, { userId: string | null; controlIds: string[]; controlCodes: string[] }>();
    for (const control of controls) {
      const key = control.ownerUserId ?? 'UNASSIGNED';
      const owner = map.get(key) ?? { userId: control.ownerUserId, controlIds: [], controlCodes: [] };
      owner.controlIds.push(control.controlId);
      owner.controlCodes.push(control.code);
      map.set(key, owner);
    }
    return [...map.values()];
  }

  private serializeReport(report: {
    id: string;
    type: string;
    format: string;
    schema_version: string;
    parameters_json: unknown;
    framework_enrollment_id: string | null;
    framework_version_id: string | null;
    status: string;
    content_type: string | null;
    file_name: string | null;
    calculated_at: Date | null;
    created_at: Date;
    completed_at: Date | null;
    expires_at: Date | null;
  }) {
    return {
      id: report.id,
      type: report.type,
      format: report.format,
      schemaVersion: report.schema_version,
      parameters: report.parameters_json,
      frameworkEnrollmentId: report.framework_enrollment_id,
      frameworkVersionId: report.framework_version_id,
      status: report.status,
      contentType: report.content_type,
      fileName: report.file_name,
      calculatedAt: iso(report.calculated_at),
      createdAt: report.created_at.toISOString(),
      completedAt: iso(report.completed_at),
      expiresAt: iso(report.expires_at),
    };
  }
}
