import type { Prisma, PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { MappingListQuery } from './mapping.schemas.js';

type Db = PrismaClient | Prisma.TransactionClient;

export class MappingsRepository {
  constructor(private readonly prisma: Db) {}

  findEvidenceVersionInTenantScope(params: { tenant: TenantContext; versionId: string }) {
    return this.prisma.evidenceVersion.findFirst({
      where: {
        id: params.versionId,
        evidence_item: { company_id: params.tenant.companyId },
      },
      include: {
        evidence_item: { select: { id: true, company_id: true, title: true } },
      },
    });
  }

  findControlInActiveTenantEnrollment(params: { tenant: TenantContext; controlId: string }) {
    return this.prisma.control.findFirst({
      where: {
        id: params.controlId,
        company_controls: {
          some: {
            company_framework: {
              company_id: params.tenant.companyId,
              status: 'ACTIVE',
            },
          },
        },
      },
      include: {
        evidence_requirements: true,
      },
    });
  }

  findRequirementForControl(params: { controlId: string; requirementId: string }) {
    return this.prisma.evidenceRequirement.findFirst({
      where: {
        id: params.requirementId,
        control_id: params.controlId,
      },
    });
  }

  findMappingInTenantScope(params: { tenant: TenantContext; mappingId: string }) {
    return this.prisma.evidenceControlMapping.findFirst({
      where: {
        id: params.mappingId,
        company_id: params.tenant.companyId,
      },
      include: {
        evidence_version: {
          include: {
            evidence_item: { select: { id: true, company_id: true, title: true } },
          },
        },
        control: { select: { id: true, code: true, title: true } },
        requirement: { select: { id: true, code: true, name: true, control_id: true } },
      },
    });
  }

  listMappingsForEvidenceVersion(params: { tenant: TenantContext; versionId: string; query: MappingListQuery }) {
    return this.prisma.evidenceControlMapping.findMany({
      where: {
        company_id: params.tenant.companyId,
        evidence_version_id: params.versionId,
        ...(params.query.status ? { status: params.query.status } : {}),
        ...(params.query.source ? { source: params.query.source } : {}),
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (params.query.page - 1) * params.query.limit,
      take: params.query.limit,
      include: {
        control: { select: { id: true, code: true, title: true, risk_level: true, control_type: true } },
        requirement: { select: { id: true, code: true, name: true, required: true } },
        mapped_by: { select: { id: true, name: true, email: true } },
        reviewed_by: { select: { id: true, name: true, email: true } },
      },
    });
  }

  findApprovedMappingForVersionRequirement(params: { evidenceVersionId: string; requirementId: string; excludeMappingId?: string }) {
    return this.prisma.evidenceControlMapping.findFirst({
      where: {
        evidence_version_id: params.evidenceVersionId,
        requirement_id: params.requirementId,
        status: 'APPROVED',
        ...(params.excludeMappingId ? { NOT: { id: params.excludeMappingId } } : {}),
      },
      select: { id: true },
    });
  }

  findOpenMappingForVersionRequirement(params: { evidenceVersionId: string; requirementId: string }) {
    return this.prisma.evidenceControlMapping.findFirst({
      where: {
        evidence_version_id: params.evidenceVersionId,
        requirement_id: params.requirementId,
        status: { in: ['SUGGESTED', 'PENDING_REVIEW', 'APPROVED'] },
      },
      select: { id: true, status: true },
    });
  }
}
