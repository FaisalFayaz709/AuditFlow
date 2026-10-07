import type { Prisma, PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../shared/tenant-context.js';

type FrameworkClient = Pick<
  PrismaClient | Prisma.TransactionClient,
  | 'framework'
  | 'frameworkVersion'
  | 'control'
  | 'evidenceRequirement'
  | 'companyFramework'
  | 'companyControl'
  | 'companyMember'
>;

export class FrameworksRepository {
  constructor(private readonly prisma: FrameworkClient) {}

  listPublishedFrameworks() {
    return this.prisma.framework.findMany({
      where: {
        versions: { some: { status: 'PUBLISHED' } },
      },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        versions: {
          where: { status: 'PUBLISHED' },
          orderBy: [{ published_at: 'desc' }, { version: 'desc' }],
          select: {
            id: true,
            version: true,
            status: true,
            published_at: true,
            _count: { select: { controls: true } },
          },
        },
      },
    });
  }

  findFrameworkDetail(frameworkId: string) {
    return this.prisma.framework.findUnique({
      where: { id: frameworkId },
      select: {
        id: true,
        name: true,
        description: true,
        versions: {
          where: { status: 'PUBLISHED' },
          orderBy: [{ published_at: 'desc' }, { version: 'desc' }],
          select: {
            id: true,
            version: true,
            status: true,
            published_at: true,
            categories: {
              orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
              select: { id: true, name: true, description: true, sort_order: true },
            },
            controls: {
              orderBy: [{ sort_order: 'asc' }, { code: 'asc' }],
              select: {
                id: true,
                code: true,
                title: true,
                description: true,
                risk_level: true,
                control_type: true,
                sort_order: true,
                category: { select: { id: true, name: true } },
                evidence_requirements: {
                  orderBy: [{ sort_order: 'asc' }, { code: 'asc' }],
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    description: true,
                    requirement_type: true,
                    required: true,
                    validity_days: true,
                    sort_order: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  findPublishedFrameworkVersion(frameworkVersionId: string) {
    return this.prisma.frameworkVersion.findFirst({
      where: { id: frameworkVersionId, status: 'PUBLISHED' },
      select: {
        id: true,
        framework_id: true,
        version: true,
        framework: { select: { id: true, name: true } },
        controls: {
          orderBy: [{ sort_order: 'asc' }, { code: 'asc' }],
          select: {
            id: true,
            code: true,
            control_type: true,
            sort_order: true,
            evidence_requirements: {
              orderBy: [{ sort_order: 'asc' }, { code: 'asc' }],
              select: { id: true, code: true, required: true, sort_order: true },
            },
          },
        },
      },
    });
  }

  findActiveEnrollment(params: { companyId: string; frameworkId: string }) {
    return this.prisma.companyFramework.findFirst({
      where: {
        company_id: params.companyId,
        framework_id: params.frameworkId,
        status: 'ACTIVE',
      },
      select: { id: true, framework_version_id: true, status: true },
    });
  }

  findEnrollmentInTenantScope(params: { tenant: TenantContext; enrollmentId: string }) {
    return this.prisma.companyFramework.findFirst({
      where: {
        id: params.enrollmentId,
        company_id: params.tenant.companyId,
        company: {
          members: {
            some: {
              id: params.tenant.membershipId,
              user_id: params.tenant.userId,
              status: 'ACTIVE',
            },
          },
        },
      },
      select: { id: true, company_id: true, framework_id: true, framework_version_id: true, status: true },
    });
  }
}
