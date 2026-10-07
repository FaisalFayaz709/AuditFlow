import type { Prisma, PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { EvidenceListQuery } from './evidence.schemas.js';

type Db = PrismaClient | Prisma.TransactionClient;

export class EvidenceRepository {
  constructor(private readonly prisma: Db) {}

  async listEvidenceInTenantScope(tenant: TenantContext, query: EvidenceListQuery, allowedEvidenceItemIds?: string[] | null) {
    const where: Prisma.EvidenceItemWhereInput = {
      company_id: tenant.companyId,
      ...(query.includeArchived ? {} : { archived_at: null }),
      ...(allowedEvidenceItemIds ? { id: { in: allowedEvidenceItemIds } } : {}),
      ...(query.sensitivityLevel ? { sensitivity_level: query.sensitivityLevel } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
              { versions: { some: { file_name: { contains: query.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
      ...(query.status ? { versions: { some: { status: query.status } } } : {}),
    };

    return this.prisma.evidenceItem.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        title: true,
        description: true,
        sensitivity_level: true,
        latest_version_id: true,
        current_approved_version_id: true,
        archived_at: true,
        created_at: true,
        latest_version: {
          select: {
            id: true,
            version_no: true,
            file_name: true,
            mime_type: true,
            file_size: true,
            sha256_checksum: true,
            status: true,
            security_scan_status: true,
            object_finalized_at: true,
            expiry_date: true,
            created_at: true,
          },
        },
      },
    });
  }

  async findEvidenceItemInTenantScope(params: { tenant: TenantContext; evidenceItemId: string }) {
    return this.prisma.evidenceItem.findFirst({
      where: { id: params.evidenceItemId, company_id: params.tenant.companyId },
      include: {
        latest_version: true,
        current_approved_version: true,
        versions: { orderBy: { version_no: 'desc' }, take: 20, include: { reviews: { orderBy: { created_at: 'desc' }, take: 5 } } },
      },
    });
  }

  async findEvidenceVersionInTenantScope(params: { tenant: TenantContext; versionId: string }) {
    return this.prisma.evidenceVersion.findFirst({
      where: {
        id: params.versionId,
        evidence_item: { company_id: params.tenant.companyId },
      },
      include: { evidence_item: true },
    });
  }

  async findNewestApprovedNonSupersededVersion(evidenceItemId: string) {
    return this.prisma.evidenceVersion.findFirst({
      where: {
        evidence_item_id: evidenceItemId,
        status: 'APPROVED',
      },
      orderBy: { version_no: 'desc' },
    });
  }

  async nextVersionNumber(evidenceItemId: string): Promise<number> {
    const aggregate = await this.prisma.evidenceVersion.aggregate({
      where: { evidence_item_id: evidenceItemId },
      _max: { version_no: true },
    });
    return (aggregate._max.version_no ?? 0) + 1;
  }
}
