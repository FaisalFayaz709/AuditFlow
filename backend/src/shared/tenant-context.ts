import { AppError } from './errors.js';

export const membershipRoles = [
  'OWNER',
  'ADMIN',
  'COMPLIANCE_MANAGER',
  'MEMBER',
  'AUDITOR',
] as const;

export type MembershipRole = (typeof membershipRoles)[number];

export const membershipStatuses = ['ACTIVE', 'DISABLED', 'REMOVED'] as const;

export type MembershipStatus = (typeof membershipStatuses)[number];

export type AuthenticatedActor = {
  userId: string;
  sessionId?: string;
};

export type CompanyMembershipRecord = {
  membershipId: string;
  companyId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
};

export type TenantContext = {
  companyId: string;
  userId: string;
  membershipId: string;
  role: MembershipRole;
};

export function assertActiveMembership(record: CompanyMembershipRecord | null): TenantContext {
  if (!record) {
    throw new AppError({
      statusCode: 403,
      code: 'TENANT_MEMBERSHIP_REQUIRED',
      message: 'An active company membership is required for this operation.',
    });
  }

  if (record.status !== 'ACTIVE') {
    throw new AppError({
      statusCode: 403,
      code: 'TENANT_MEMBERSHIP_INACTIVE',
      message: 'The company membership is not active.',
    });
  }

  return {
    companyId: record.companyId,
    userId: record.userId,
    membershipId: record.membershipId,
    role: record.role,
  };
}
