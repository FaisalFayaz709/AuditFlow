import type { Prisma, PrismaClient } from '@prisma/client';
import type { CompanyMembershipLookup } from '../../shared/tenant-boundary.js';
import type { CompanyMembershipRecord, MembershipRole, MembershipStatus, TenantContext } from '../../shared/tenant-context.js';
import type { CompanyUpdateBody } from './company.schemas.js';

export type CompanySummary = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
};

export type MemberSummary = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
};

type CompanyClient = Pick<PrismaClient | Prisma.TransactionClient, 'company' | 'companyMember'>;

export class PrismaCompanyMembershipLookup implements CompanyMembershipLookup {
  constructor(private readonly prisma: Pick<PrismaClient | Prisma.TransactionClient, 'companyMember'>) {}

  async findMembershipForUserCompany(params: {
    userId: string;
    companyId: string;
  }): Promise<CompanyMembershipRecord | null> {
    const membership = await this.prisma.companyMember.findUnique({
      where: {
        company_id_user_id: {
          company_id: params.companyId,
          user_id: params.userId,
        },
      },
      select: {
        id: true,
        company_id: true,
        user_id: true,
        role: true,
        status: true,
      },
    });

    if (!membership) {
      return null;
    }

    return {
      membershipId: membership.id,
      companyId: membership.company_id,
      userId: membership.user_id,
      role: membership.role as MembershipRole,
      status: membership.status as MembershipStatus,
    };
  }
}

export class PrismaCompanyRepository {
  constructor(private readonly prisma: CompanyClient) {}

  async findCompanyInTenantScope(tenant: TenantContext): Promise<CompanySummary | null> {
    return this.prisma.company.findFirst({
      where: {
        id: tenant.companyId,
        members: {
          some: {
            id: tenant.membershipId,
            user_id: tenant.userId,
            status: 'ACTIVE',
          },
        },
      },
      select: {
        id: true,
        name: true,
        industry: true,
        website: true,
      },
    });
  }

  async updateCompanyInTenantScope(tenant: TenantContext, body: CompanyUpdateBody): Promise<CompanySummary | null> {
    const existing = await this.findCompanyInTenantScope(tenant);
    if (!existing) return null;

    return this.prisma.company.update({
      where: { id: tenant.companyId },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.industry !== undefined ? { industry: body.industry?.trim() ?? null } : {}),
        ...(body.website !== undefined ? { website: body.website?.trim() ?? null } : {}),
      },
      select: {
        id: true,
        name: true,
        industry: true,
        website: true,
      },
    });
  }

  async listMembers(tenant: TenantContext): Promise<MemberSummary[]> {
    const members = await this.prisma.companyMember.findMany({
      where: { company_id: tenant.companyId },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        user_id: true,
        role: true,
        status: true,
        created_at: true,
        updated_at: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return members.map((member) => ({
      id: member.id,
      userId: member.user_id,
      name: member.user.name,
      email: member.user.email,
      role: member.role as MembershipRole,
      status: member.status as MembershipStatus,
      createdAt: member.created_at.toISOString(),
      updatedAt: member.updated_at.toISOString(),
    }));
  }

  async findMemberInTenantScope(tenant: TenantContext, memberId: string): Promise<{
    id: string;
    company_id: string;
    user_id: string;
    role: MembershipRole;
    status: MembershipStatus;
    user: { name: string; email: string };
  } | null> {
    const member = await this.prisma.companyMember.findFirst({
      where: { id: memberId, company_id: tenant.companyId },
      select: {
        id: true,
        company_id: true,
        user_id: true,
        role: true,
        status: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!member) return null;
    return {
      ...member,
      role: member.role as MembershipRole,
      status: member.status as MembershipStatus,
    };
  }

  async countActiveOwners(companyId: string): Promise<number> {
    return this.prisma.companyMember.count({
      where: { company_id: companyId, role: 'OWNER', status: 'ACTIVE' },
    });
  }
}
