import type { Prisma, PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { ControlsQuery } from './control.schemas.js';

type ControlsClient = Pick<PrismaClient | Prisma.TransactionClient, 'companyControl' | 'companyFramework' | 'companyMember'>;

export class ControlsRepository {
  constructor(private readonly prisma: ControlsClient) {}

  listControlsInTenantScope(tenant: TenantContext, query: ControlsQuery) {
    return this.prisma.companyControl.findMany({
      where: {
        company_framework: {
          company_id: tenant.companyId,
          status: 'ACTIVE',
          ...(query.companyFrameworkId ? { id: query.companyFrameworkId } : {}),
          company: {
            members: {
              some: {
                id: tenant.membershipId,
                user_id: tenant.userId,
                status: 'ACTIVE',
              },
            },
          },
        },
        ...(query.status ? { applicability: query.status } : {}),
        ...(query.ownerUserId ? { owner_user_id: query.ownerUserId } : {}),
        control: {
          ...(query.riskLevel ? { risk_level: query.riskLevel } : {}),
          ...(query.controlType ? { control_type: query.controlType } : {}),
        },
      },
      orderBy: [{ control: { sort_order: 'asc' } }, { control: { code: 'asc' } }],
      select: {
        id: true,
        applicability: true,
        not_applicable_reason: true,
        owner_user_id: true,
        company_framework_id: true,
        company_framework: {
          select: {
            id: true,
            framework: { select: { id: true, name: true } },
            framework_version: { select: { id: true, version: true } },
          },
        },
        owner: { select: { id: true, name: true, email: true } },
        control: {
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
    });
  }

  findCompanyControlInTenantScope(params: { tenant: TenantContext; companyControlId: string }) {
    return this.prisma.companyControl.findFirst({
      where: {
        id: params.companyControlId,
        company_framework: {
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
      },
      select: {
        id: true,
        applicability: true,
        not_applicable_reason: true,
        not_applicable_approved_by: true,
        owner_user_id: true,
        company_framework_id: true,
        control: {
          select: {
            id: true,
            code: true,
            title: true,
            description: true,
            risk_level: true,
            control_type: true,
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
        owner: { select: { id: true, name: true, email: true } },
        not_applicable_approver: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findActiveMemberInCompany(params: { companyId: string; userId: string }) {
    return this.prisma.companyMember.findFirst({
      where: { company_id: params.companyId, user_id: params.userId, status: 'ACTIVE' },
      select: { id: true, user_id: true, role: true },
    });
  }
}
