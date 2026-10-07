import type { PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { DashboardQuery } from './dashboard.schemas.js';

type Db = PrismaClient;

export class DashboardRepository {
  constructor(private readonly prisma: Db) {}


  findActiveCompanyFrameworkInTenantScope(params: { tenant: TenantContext; companyFrameworkId: string }) {
    return this.prisma.companyFramework.findFirst({
      where: {
        id: params.companyFrameworkId,
        company_id: params.tenant.companyId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
  }

  listActiveControlsForReadiness(params: { tenant: TenantContext; companyFrameworkId?: string }) {
    return this.prisma.companyControl.findMany({
      where: {
        company_framework: {
          company_id: params.tenant.companyId,
          status: 'ACTIVE',
          ...(params.companyFrameworkId ? { id: params.companyFrameworkId } : {}),
        },
      },
      orderBy: [
        { control: { sort_order: 'asc' } },
        { id: 'asc' },
      ],
      include: {
        control: {
          include: {
            evidence_requirements: {
              orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });
  }

  listMappingsForActiveCompanyControls(params: { tenant: TenantContext; controlIds: string[] }) {
    if (params.controlIds.length === 0) return Promise.resolve([]);
    return this.prisma.evidenceControlMapping.findMany({
      where: {
        company_id: params.tenant.companyId,
        control_id: { in: params.controlIds },
      },
      select: {
        id: true,
        control_id: true,
        requirement_id: true,
        status: true,
        reviewed_by_user_id: true,
        reviewed_at: true,
        mapped_by_user_id: true,
        source: true,
        ai_confidence: true,
        evidence_version: {
          select: {
            id: true,
            status: true,
            expiry_date: true,
            effective_from: true,
            effective_until: true,
            reviews: {
              where: { decision: 'APPROVED' },
              orderBy: { created_at: 'desc' },
              take: 1,
              select: { id: true, reviewer_user_id: true, created_at: true },
            },
            evidence_item: { select: { archived_at: true, company_id: true } },
          },
        },
      },
    });
  }

  countOverdueTasks(params: { tenant: TenantContext; now: Date }) {
    return this.prisma.task.count({
      where: {
        company_id: params.tenant.companyId,
        due_date: { lt: params.now },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });
  }

  listOverdueTasks(params: { tenant: TenantContext; now: Date }) {
    return this.prisma.task.findMany({
      where: {
        company_id: params.tenant.companyId,
        due_date: { lt: params.now },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      orderBy: [{ due_date: 'asc' }, { id: 'asc' }],
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        due_date: true,
        assigned_to_user_id: true,
        company_control: {
          select: {
            id: true,
            control: { select: { code: true, title: true, risk_level: true } },
          },
        },
      },
    });
  }

  countEvidenceVersionsNeedingReview(params: { tenant: TenantContext }) {
    return this.prisma.evidenceVersion.count({
      where: {
        status: 'NEEDS_REVIEW',
        evidence_item: {
          company_id: params.tenant.companyId,
          archived_at: null,
        },
      },
    });
  }

  countMappingsNeedingReview(params: { tenant: TenantContext }) {
    return this.prisma.evidenceControlMapping.count({
      where: {
        company_id: params.tenant.companyId,
        status: { in: ['SUGGESTED', 'PENDING_REVIEW'] },
      },
    });
  }

  countExpiringEvidenceVersions(params: { tenant: TenantContext; now: Date; through: Date }) {
    return this.prisma.evidenceVersion.count({
      where: {
        status: 'APPROVED',
        expiry_date: {
          gte: params.now,
          lte: params.through,
        },
        evidence_item: {
          company_id: params.tenant.companyId,
          archived_at: null,
        },
      },
    });
  }

  listExpiringEvidenceVersions(params: { tenant: TenantContext; query: DashboardQuery; now: Date; through: Date }) {
    return this.prisma.evidenceVersion.findMany({
      where: {
        status: 'APPROVED',
        expiry_date: {
          gte: params.now,
          lte: params.through,
        },
        evidence_item: {
          company_id: params.tenant.companyId,
          archived_at: null,
        },
      },
      orderBy: [{ expiry_date: 'asc' }, { id: 'asc' }],
      take: 100,
      select: {
        id: true,
        version_no: true,
        file_name: true,
        status: true,
        expiry_date: true,
        evidence_item: {
          select: {
            id: true,
            title: true,
            sensitivity_level: true,
          },
        },
      },
    });
  }
}
