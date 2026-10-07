import type { FastifyRequest } from 'fastify';
import { AppError, tenantSafeNotFoundError } from './errors.js';
import { assertActiveMembership, type AuthenticatedActor, type CompanyMembershipRecord, type TenantContext } from './tenant-context.js';

export type CompanyMembershipLookup = {
  findMembershipForUserCompany(params: {
    userId: string;
    companyId: string;
  }): Promise<CompanyMembershipRecord | null>;
};

export async function requireCompanyMembership(params: {
  lookup: CompanyMembershipLookup;
  userId: string;
  companyId: string;
}): Promise<TenantContext> {
  const membership = await params.lookup.findMembershipForUserCompany({
    userId: params.userId,
    companyId: params.companyId,
  });

  return assertActiveMembership(membership);
}

export function requireAuthenticatedUser(request: FastifyRequest): AuthenticatedActor {
  const actor = request.requestContext.actor;

  if (!actor) {
    throw new AppError({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication is required for this operation.',
    });
  }

  return actor;
}

export async function loadEntityInTenantScope<T>(params: {
  tenant: TenantContext;
  entityType: string;
  entityId: string;
  load: (tenant: TenantContext) => Promise<T | null>;
}): Promise<T> {
  const entity = await params.load(params.tenant);

  if (!entity) {
    throw tenantSafeNotFoundError(params.entityType);
  }

  return entity;
}
