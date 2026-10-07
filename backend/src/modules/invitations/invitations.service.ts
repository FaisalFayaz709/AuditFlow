import type { InvitationStatus, PrismaClient } from '@prisma/client';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import type { AppEnv } from '../../config/env.js';
import { addSeconds, generateOpaqueToken, hashOpaqueToken, normalizeEmail } from '../../shared/crypto.js';
import { AppError } from '../../shared/errors.js';
import { requirePermission } from '../authz/permissions.js';
import type { MembershipRole, TenantContext } from '../../shared/tenant-context.js';
import type { InviteMemberBody, ResendInvitationBody } from './invitations.schemas.js';

const DEFAULT_INVITATION_DAYS = 7;
const SECONDS_PER_DAY = 24 * 60 * 60;

export type InvitationDetail = {
  id: string;
  companyId: string;
  email: string;
  role: MembershipRole;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export function isInvitationExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt <= now;
}

export function assertInvitationActive(params: {
  status: InvitationStatus;
  expiresAt: Date;
  now?: Date;
}): void {
  if (params.status !== 'PENDING') {
    throw new AppError({
      statusCode: 409,
      code: 'INVITATION_NOT_PENDING',
      message: 'Only pending invitations can be used for this action.',
    });
  }

  if (isInvitationExpired(params.expiresAt, params.now)) {
    throw new AppError({
      statusCode: 422,
      code: 'INVITATION_EXPIRED',
      message: 'The invitation has expired.',
    });
  }
}

export class InvitationsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: AppEnv,
  ) {}

  async listCompanyInvitations(tenant: TenantContext): Promise<InvitationDetail[]> {
    requirePermission(tenant, 'members.read');
    const rows = await this.prisma.companyInvitation.findMany({
      where: { company_id: tenant.companyId },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        company_id: true,
        email: true,
        role: true,
        status: true,
        expires_at: true,
        accepted_at: true,
        revoked_at: true,
        created_at: true,
      },
    });

    return rows.map((row) => this.toDetail(row));
  }

  async inviteMember(params: {
    tenant: TenantContext;
    body: InviteMemberBody;
    requestId: string;
    sessionId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<InvitationDetail & { devInvitationToken?: string }> {
    requirePermission(params.tenant, 'members.manage');

    const email = normalizeEmail(params.body.email);
    const role = params.body.role;
    const token = generateOpaqueToken(32);
    const tokenHash = hashOpaqueToken(token, this.env.SESSION_PEPPER);
    const expiresAt = addSeconds(new Date(), DEFAULT_INVITATION_DAYS * SECONDS_PER_DAY);

    const invitation = await this.prisma.$transaction(async (tx) => {
      const existingMember = await tx.companyMember.findFirst({
        where: {
          company_id: params.tenant.companyId,
          user: { email },
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      if (existingMember) {
        throw new AppError({
          statusCode: 409,
          code: 'MEMBER_ALREADY_ACTIVE',
          message: 'This user is already an active member of the company.',
        });
      }

      await tx.companyInvitation.updateMany({
        where: {
          company_id: params.tenant.companyId,
          email,
          status: 'PENDING',
        },
        data: {
          status: 'REVOKED',
          revoked_at: new Date(),
          revoked_by_user_id: params.tenant.userId,
        },
      });

      const created = await tx.companyInvitation.create({
        data: {
          company_id: params.tenant.companyId,
          email,
          role,
          token_hash: tokenHash,
          invited_by_user_id: params.tenant.userId,
          expires_at: expiresAt,
        },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.sessionId,
        action: 'MEMBER_INVITED',
        entityType: 'company_invitation',
        entityId: created.id,
        metadata: { email, role, expiresAt: expiresAt.toISOString() },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });

      return created;
    });

    return {
      ...this.toDetail(invitation),
      ...(this.env.NODE_ENV === 'production' ? {} : { devInvitationToken: token }),
    };
  }

  async resendInvitation(params: {
    tenant: TenantContext;
    invitationId: string;
    body: ResendInvitationBody;
    requestId: string;
    sessionId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<InvitationDetail & { devInvitationToken?: string }> {
    requirePermission(params.tenant, 'members.manage');

    const token = generateOpaqueToken(32);
    const tokenHash = hashOpaqueToken(token, this.env.SESSION_PEPPER);
    const days = params.body.expiresInDays ?? DEFAULT_INVITATION_DAYS;
    const expiresAt = addSeconds(new Date(), days * SECONDS_PER_DAY);

    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.companyInvitation.findFirst({
        where: { id: params.invitationId, company_id: params.tenant.companyId },
      });

      if (!existing) {
        throw new AppError({ statusCode: 404, code: 'INVITATION_NOT_FOUND', message: 'Invitation was not found.' });
      }

      assertInvitationActive({ status: existing.status, expiresAt: existing.expires_at });

      await tx.companyInvitation.update({
        where: { id: existing.id },
        data: {
          status: 'REVOKED',
          revoked_at: new Date(),
          revoked_by_user_id: params.tenant.userId,
        },
      });

      const replacement = await tx.companyInvitation.create({
        data: {
          company_id: existing.company_id,
          email: existing.email,
          role: existing.role,
          token_hash: tokenHash,
          invited_by_user_id: params.tenant.userId,
          expires_at: expiresAt,
        },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.sessionId,
        action: 'MEMBER_INVITED',
        entityType: 'company_invitation',
        entityId: replacement.id,
        metadata: { replacedInvitationId: existing.id, email: existing.email, role: existing.role },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });

      return replacement;
    });

    return {
      ...this.toDetail(created),
      ...(this.env.NODE_ENV === 'production' ? {} : { devInvitationToken: token }),
    };
  }

  async revokeInvitation(params: {
    tenant: TenantContext;
    invitationId: string;
    requestId: string;
    sessionId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<void> {
    requirePermission(params.tenant, 'members.manage');

    await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.companyInvitation.findFirst({
        where: { id: params.invitationId, company_id: params.tenant.companyId },
      });

      if (!invitation) {
        throw new AppError({ statusCode: 404, code: 'INVITATION_NOT_FOUND', message: 'Invitation was not found.' });
      }

      assertInvitationActive({ status: invitation.status, expiresAt: invitation.expires_at });

      await tx.companyInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'REVOKED',
          revoked_at: new Date(),
          revoked_by_user_id: params.tenant.userId,
        },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.sessionId,
        action: 'MEMBER_INVITATION_REVOKED',
        entityType: 'company_invitation',
        entityId: invitation.id,
        metadata: { email: invitation.email, role: invitation.role },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });
    });
  }

  async acceptInvitation(params: {
    token: string;
    userId: string;
    requestId: string;
    sessionId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }): Promise<{ companyId: string; membershipId: string; role: MembershipRole }> {
    const tokenHash = hashOpaqueToken(params.token, this.env.SESSION_PEPPER);

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.companyInvitation.findUnique({
        where: { token_hash: tokenHash },
        select: {
          id: true,
          company_id: true,
          email: true,
          role: true,
          status: true,
          expires_at: true,
        },
      });

      if (!invitation) {
        throw new AppError({ statusCode: 404, code: 'INVITATION_NOT_FOUND', message: 'Invitation was not found.' });
      }

      assertInvitationActive({ status: invitation.status, expiresAt: invitation.expires_at });

      const user = await tx.user.findUnique({
        where: { id: params.userId },
        select: { id: true, email: true, name: true },
      });

      if (!user) {
        throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'A valid user is required.' });
      }

      if (normalizeEmail(user.email) !== invitation.email) {
        throw new AppError({
          statusCode: 403,
          code: 'INVITATION_EMAIL_MISMATCH',
          message: 'The signed-in email does not match the invitation email.',
        });
      }

      const existingMembership = await tx.companyMember.findUnique({
        where: {
          company_id_user_id: {
            company_id: invitation.company_id,
            user_id: user.id,
          },
        },
        select: { id: true, status: true, role: true },
      });

      if (existingMembership?.status === 'ACTIVE') {
        throw new AppError({
          statusCode: 409,
          code: 'MEMBER_ALREADY_ACTIVE',
          message: 'This user is already an active member of the company.',
        });
      }

      const membership = existingMembership
        ? await tx.companyMember.update({
            where: { id: existingMembership.id },
            data: { role: invitation.role, status: 'ACTIVE' },
            select: { id: true, role: true },
          })
        : await tx.companyMember.create({
            data: {
              company_id: invitation.company_id,
              user_id: user.id,
              role: invitation.role,
              status: 'ACTIVE',
            },
            select: { id: true, role: true },
          });

      await tx.companyInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          accepted_at: new Date(),
          accepted_by_user_id: user.id,
        },
      });

      const tenant: TenantContext = {
        companyId: invitation.company_id,
        userId: user.id,
        membershipId: membership.id,
        role: membership.role as MembershipRole,
      };

      await new AuditLogService(tx).recordEvent({
        tenant,
        sessionId: params.sessionId,
        action: 'MEMBER_INVITATION_ACCEPTED',
        entityType: 'company_member',
        entityId: membership.id,
        metadata: { invitationId: invitation.id, email: invitation.email, role: invitation.role },
        actorSnapshot: { email: user.email, name: user.name, role: membership.role },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });

      return {
        companyId: invitation.company_id,
        membershipId: membership.id,
        role: membership.role as MembershipRole,
      };
    });
  }

  private toDetail(row: {
    id: string;
    company_id: string;
    email: string;
    role: MembershipRole;
    status: InvitationStatus;
    expires_at: Date;
    accepted_at: Date | null;
    revoked_at: Date | null;
    created_at: Date;
  }): InvitationDetail {
    return {
      id: row.id,
      companyId: row.company_id,
      email: row.email,
      role: row.role,
      status: row.status,
      expiresAt: row.expires_at.toISOString(),
      acceptedAt: row.accepted_at?.toISOString() ?? null,
      revokedAt: row.revoked_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    };
  }
}
