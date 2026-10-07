import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors.js';
import { requirePermission } from '../authz/permissions.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { DashboardQuery } from './dashboard.schemas.js';
import { DashboardRepository } from './dashboard.repository.js';
import { calculateReadiness, type ReadinessControlInput } from './readiness-calculator.js';
import { buildReadinessTrace } from './readiness-trace.js';

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export class DashboardService {
  constructor(private readonly prisma: PrismaClient) {}

  async getOverview(params: { tenant: TenantContext; query: DashboardQuery }) {
    requirePermission(params.tenant, 'dashboard.read');
    const now = new Date();
    const repository = new DashboardRepository(this.prisma);

    const readiness = await this.calculateCurrentReadiness({ tenant: params.tenant, ...(params.query.companyFrameworkId ? { companyFrameworkId: params.query.companyFrameworkId } : {}), now });
    const evidenceNeedingReview = await repository.countEvidenceVersionsNeedingReview({ tenant: params.tenant });
    const mappingsNeedingReview = await repository.countMappingsNeedingReview({ tenant: params.tenant });
    const expiringWithin = await repository.countExpiringEvidenceVersions({
      tenant: params.tenant,
      now,
      through: addDays(now, params.query.expiringDays),
    });
    const overdueTasks = await repository.countOverdueTasks({ tenant: params.tenant, now });

    return {
      readinessStatus: readiness.readinessStatus,
      readinessPercent: readiness.readinessPercent,
      applicableEvidenceBasedControls: readiness.eligibleControls,
      readyControls: readiness.readyControls,
      inProgressControls: readiness.inProgressControls,
      notStartedControls: readiness.notStartedControls,
      missingRequiredEvidence: readiness.missingRequiredEvidence,
      overdueTasks,
      needsReview: evidenceNeedingReview + mappingsNeedingReview,
      evidenceVersionsNeedingReview: evidenceNeedingReview,
      mappingsNeedingReview,
      expiringWithinDays: params.query.expiringDays,
      expiringWithinDaysCount: expiringWithin,
      calculatedAt: now.toISOString(),
    };
  }

  async getControlProgress(params: { tenant: TenantContext; query: DashboardQuery }) {
    requirePermission(params.tenant, 'dashboard.read');
    const readiness = await this.calculateCurrentReadiness({ tenant: params.tenant, ...(params.query.companyFrameworkId ? { companyFrameworkId: params.query.companyFrameworkId } : {}), now: new Date() });
    return {
      readinessStatus: readiness.readinessStatus,
      readinessPercent: readiness.readinessPercent,
      controls: readiness.controlCoverage,
    };
  }

  async getMissingEvidence(params: { tenant: TenantContext; query: DashboardQuery }) {
    requirePermission(params.tenant, 'dashboard.read');
    const readiness = await this.calculateCurrentReadiness({ tenant: params.tenant, ...(params.query.companyFrameworkId ? { companyFrameworkId: params.query.companyFrameworkId } : {}), now: new Date() });
    return {
      readinessStatus: readiness.readinessStatus,
      missingRequiredEvidence: readiness.missingRequiredEvidence,
      items: readiness.missingRequirements,
    };
  }

  async getReadinessTrace(params: { tenant: TenantContext; query: DashboardQuery }) {
    requirePermission(params.tenant, 'dashboard.read');
    const now = new Date();
    const controls = await this.loadReadinessControls({ tenant: params.tenant, ...(params.query.companyFrameworkId ? { companyFrameworkId: params.query.companyFrameworkId } : {}) });
    const readiness = calculateReadiness({ controls, now });
    return buildReadinessTrace({ controls, readinessStatus: readiness.readinessStatus, readinessPercent: readiness.readinessPercent, calculatedAt: now });
  }

  async getControlReadinessExplanation(params: { tenant: TenantContext; companyControlId: string }) {
    requirePermission(params.tenant, 'dashboard.read');
    const now = new Date();
    const controls = await this.loadReadinessControls({ tenant: params.tenant });
    const readiness = calculateReadiness({ controls, now });
    const trace = buildReadinessTrace({ controls, readinessStatus: readiness.readinessStatus, readinessPercent: readiness.readinessPercent, calculatedAt: now });
    const control = trace.controls.find((item) => item.companyControlId === params.companyControlId || item.controlId === params.companyControlId);
    if (!control) {
      throw new AppError({ statusCode: 404, code: 'CONTROL_NOT_FOUND', message: 'Control was not found in the active company framework scope.' });
    }
    return {
      calculatedAt: trace.calculatedAt,
      readinessStatus: trace.readinessStatus,
      readinessPercent: trace.readinessPercent,
      traceScope: trace.traceScope,
      control,
    };
  }

  async getOverdueTasks(params: { tenant: TenantContext }) {
    requirePermission(params.tenant, 'dashboard.read');
    const now = new Date();
    const items = await new DashboardRepository(this.prisma).listOverdueTasks({ tenant: params.tenant, now });
    return { calculatedAt: now.toISOString(), items };
  }

  async getExpiringEvidence(params: { tenant: TenantContext; query: DashboardQuery }) {
    requirePermission(params.tenant, 'dashboard.read');
    const now = new Date();
    const repository = new DashboardRepository(this.prisma);
    const through = addDays(now, params.query.expiringDays);
    const items = await repository.listExpiringEvidenceVersions({ tenant: params.tenant, query: params.query, now, through });
    return {
      expiringWithinDays: params.query.expiringDays,
      items,
    };
  }

  private async calculateCurrentReadiness(params: { tenant: TenantContext; companyFrameworkId?: string; now: Date }) {
    const controls = await this.loadReadinessControls({ tenant: params.tenant, ...(params.companyFrameworkId ? { companyFrameworkId: params.companyFrameworkId } : {}) });
    return calculateReadiness({ controls, now: params.now });
  }

  private async loadReadinessControls(params: { tenant: TenantContext; companyFrameworkId?: string }) {
    const repository = new DashboardRepository(this.prisma);
    if (params.companyFrameworkId) {
      const enrollment = await repository.findActiveCompanyFrameworkInTenantScope({
        tenant: params.tenant,
        companyFrameworkId: params.companyFrameworkId,
      });
      if (!enrollment) {
        throw new AppError({
          statusCode: 404,
          code: 'COMPANY_FRAMEWORK_NOT_FOUND',
          message: 'Active framework enrollment was not found.',
        });
      }
    }

    const companyControls = await repository.listActiveControlsForReadiness({ tenant: params.tenant, ...(params.companyFrameworkId ? { companyFrameworkId: params.companyFrameworkId } : {}) });
    const controlIds = companyControls.map((companyControl) => companyControl.control_id);
    const mappings = await repository.listMappingsForActiveCompanyControls({ tenant: params.tenant, controlIds });
    const mappingsByControl = new Map<string, typeof mappings>();

    for (const mapping of mappings) {
      const current = mappingsByControl.get(mapping.control_id) ?? [];
      current.push(mapping);
      mappingsByControl.set(mapping.control_id, current);
    }

    return companyControls.map<ReadinessControlInput>((companyControl) => ({
      companyControlId: companyControl.id,
      controlId: companyControl.control.id,
      code: companyControl.control.code,
      title: companyControl.control.title,
      riskLevel: companyControl.control.risk_level,
      controlType: companyControl.control.control_type,
      applicability: companyControl.applicability,
      ownerUserId: companyControl.owner_user_id,
      requirements: companyControl.control.evidence_requirements.map((requirement) => ({
        id: requirement.id,
        code: requirement.code,
        name: requirement.name,
        required: requirement.required,
      })),
      mappings: (mappingsByControl.get(companyControl.control.id) ?? []).map((mapping) => {
        const approvalReview = mapping.evidence_version.reviews[0] ?? null;
        return {
          id: mapping.id,
          requirementId: mapping.requirement_id,
          status: mapping.status,
          source: mapping.source,
          traceMetadata: { storedConfidence: mapping.ai_confidence === null ? null : Number(mapping.ai_confidence) },
          mappedByUserId: mapping.mapped_by_user_id,
          mappingReview: { reviewedByUserId: mapping.reviewed_by_user_id, reviewedAt: mapping.reviewed_at },
          evidenceVersion: {
            id: mapping.evidence_version.id,
            status: mapping.evidence_version.status,
            expiryDate: mapping.evidence_version.expiry_date,
            effectiveFrom: mapping.evidence_version.effective_from,
            effectiveUntil: mapping.evidence_version.effective_until,
            evidenceItemArchivedAt: mapping.evidence_version.evidence_item.archived_at,
            approval: approvalReview
              ? { reviewId: approvalReview.id, reviewerUserId: approvalReview.reviewer_user_id, reviewedAt: approvalReview.created_at }
              : null,
          },
        };
      }),
    }));
  }
}
