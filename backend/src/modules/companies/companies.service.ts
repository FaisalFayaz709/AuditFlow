import type { PrismaClient } from '@prisma/client';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import { AppError } from '../../shared/errors.js';
import { requirePermission } from '../authz/permissions.js';
import { loadEntityInTenantScope } from '../../shared/tenant-boundary.js';
import type { MembershipRole, MembershipStatus, TenantContext } from '../../shared/tenant-context.js';
import type { CompanyCreateBody, CompanyUpdateBody, RemoveMemberBody, RoleChangeBody } from './company.schemas.js';
import { PrismaCompanyRepository, type CompanySummary, type MemberSummary } from './companies.repository.js';

export function assertRoleChangeAllowed(params: {
  actorRole: MembershipRole;
  targetRole: MembershipRole;
  nextRole: MembershipRole;
  targetStatus: string;
  activeOwnerCount: number;
}): void {
  if (params.targetStatus !== 'ACTIVE') {
    throw new AppError({
      statusCode: 409,
      code: 'MEMBER_INACTIVE',
      message: 'Inactive or removed memberships cannot be changed.',
    });
  }

  if (params.nextRole === 'OWNER' && params.actorRole !== 'OWNER') {
    throw new AppError({
      statusCode: 403,
      code: 'OWNER_ROLE_REQUIRES_OWNER',
      message: 'Only an OWNER may grant OWNER role.',
    });
  }

  if (params.targetRole === 'OWNER' && params.nextRole !== 'OWNER' && params.activeOwnerCount <= 1) {
    throw new AppError({
      statusCode: 422,
      code: 'FINAL_OWNER_PROTECTED',
      message: 'The final active OWNER cannot be demoted.',
    });
  }
}

export function assertMemberRemovalAllowed(params: {
  targetRole: MembershipRole;
  targetStatus: string;
  activeOwnerCount: number;
}): void {
  if (params.targetStatus !== 'ACTIVE') {
    throw new AppError({
      statusCode: 409,
      code: 'MEMBER_INACTIVE',
      message: 'The membership is already inactive or removed.',
    });
  }

  if (params.targetRole === 'OWNER' && params.activeOwnerCount <= 1) {
    throw new AppError({
      statusCode: 422,
      code: 'FINAL_OWNER_PROTECTED',
      message: 'The final active OWNER cannot be removed.',
    });
  }
}

export class CompaniesService {
  constructor(private readonly prisma: PrismaClient) {}

  async createCompany(params: {
    userId: string;
    body: CompanyCreateBody;
    requestId: string;
    sessionId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<CompanySummary & { membershipId: string; role: MembershipRole }> {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: params.body.name.trim(),
          industry: params.body.industry?.trim() ?? null,
          website: params.body.website?.trim() ?? null,
        },
        select: { id: true, name: true, industry: true, website: true },
      });

      const membership = await tx.companyMember.create({
        data: {
          company_id: company.id,
          user_id: params.userId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        select: { id: true, role: true },
      });

      const tenant: TenantContext = {
        companyId: company.id,
        userId: params.userId,
        membershipId: membership.id,
        role: membership.role as MembershipRole,
      };

      await new AuditLogService(tx).recordEvent({
        tenant,
        sessionId: params.sessionId,
        action: 'COMPANY_CREATED',
        entityType: 'company',
        entityId: company.id,
        metadata: { name: company.name },
        actorSnapshot: { role: membership.role },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });

      return {
        ...company,
        membershipId: membership.id,
        role: membership.role as MembershipRole,
      };
    });
  }

  async getCurrentCompany(tenant: TenantContext): Promise<CompanySummary> {
    requirePermission(tenant, 'company.read');
    const companies = new PrismaCompanyRepository(this.prisma);

    return loadEntityInTenantScope({
      tenant,
      entityType: 'company',
      entityId: tenant.companyId,
      load: async (tenantContext) => companies.findCompanyInTenantScope(tenantContext),
    });
  }

  async updateCompany(params: {
    tenant: TenantContext;
    body: CompanyUpdateBody;
    requestId: string;
    sessionId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<CompanySummary> {
    requirePermission(params.tenant, 'company.update');

    return this.prisma.$transaction(async (tx) => {
      const repository = new PrismaCompanyRepository(tx);
      const before = await repository.findCompanyInTenantScope(params.tenant);
      if (!before) {
        throw new AppError({ statusCode: 404, code: 'COMPANY_NOT_FOUND', message: 'Company was not found.' });
      }

      const updated = await repository.updateCompanyInTenantScope(params.tenant, params.body);
      if (!updated) {
        throw new AppError({ statusCode: 404, code: 'COMPANY_NOT_FOUND', message: 'Company was not found.' });
      }

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.sessionId,
        action: 'COMPANY_PROFILE_UPDATED',
        entityType: 'company',
        entityId: params.tenant.companyId,
        metadata: { before, after: updated },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });

      return updated;
    });
  }

  async listMembers(tenant: TenantContext): Promise<MemberSummary[]> {
    requirePermission(tenant, 'members.read');
    return new PrismaCompanyRepository(this.prisma).listMembers(tenant);
  }

  async changeMemberRole(params: {
    tenant: TenantContext;
    memberId: string;
    body: RoleChangeBody;
    requestId: string;
    sessionId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<MemberSummary> {
    requirePermission(params.tenant, 'members.manage');

    return this.prisma.$transaction(async (tx) => {
      const repository = new PrismaCompanyRepository(tx);
      const target = await repository.findMemberInTenantScope(params.tenant, params.memberId);
      if (!target) {
        throw new AppError({ statusCode: 404, code: 'MEMBER_NOT_FOUND', message: 'Member was not found.' });
      }

      const activeOwnerCount = await repository.countActiveOwners(params.tenant.companyId);
      assertRoleChangeAllowed({
        actorRole: params.tenant.role,
        targetRole: target.role,
        nextRole: params.body.role,
        targetStatus: target.status,
        activeOwnerCount,
      });

      const updated = await tx.companyMember.update({
        where: { id: params.memberId },
        data: { role: params.body.role },
        select: {
          id: true,
          user_id: true,
          role: true,
          status: true,
          created_at: true,
          updated_at: true,
          user: { select: { name: true, email: true } },
        },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.sessionId,
        action: 'MEMBER_ROLE_CHANGED',
        entityType: 'company_member',
        entityId: updated.id,
        metadata: {
          userId: updated.user_id,
          beforeRole: target.role,
          afterRole: updated.role,
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });

      return {
        id: updated.id,
        userId: updated.user_id,
        name: updated.user.name,
        email: updated.user.email,
        role: updated.role as MembershipRole,
        status: updated.status as MembershipStatus,
        createdAt: updated.created_at.toISOString(),
        updatedAt: updated.updated_at.toISOString(),
      };
    });
  }

  async removeMember(params: {
    tenant: TenantContext;
    memberId: string;
    body: RemoveMemberBody;
    requestId: string;
    sessionId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<void> {
    requirePermission(params.tenant, 'members.manage');

    await this.prisma.$transaction(async (tx) => {
      const repository = new PrismaCompanyRepository(tx);
      const target = await repository.findMemberInTenantScope(params.tenant, params.memberId);
      if (!target) {
        throw new AppError({ statusCode: 404, code: 'MEMBER_NOT_FOUND', message: 'Member was not found.' });
      }

      const activeOwnerCount = await repository.countActiveOwners(params.tenant.companyId);
      assertMemberRemovalAllowed({
        targetRole: target.role,
        targetStatus: target.status,
        activeOwnerCount,
      });

      await tx.companyMember.update({
        where: { id: params.memberId },
        data: { status: 'REMOVED' },
      });

      await tx.session.updateMany({
        where: { user_id: target.user_id, revoked_at: null },
        data: { revoked_at: new Date(), revoked_reason: 'membership_removed' },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.sessionId,
        action: 'MEMBER_REMOVED',
        entityType: 'company_member',
        entityId: params.memberId,
        metadata: {
          targetUserId: target.user_id,
          targetEmail: target.user.email,
          priorRole: target.role,
          reason: params.body.reason,
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });
    });
  }
}
