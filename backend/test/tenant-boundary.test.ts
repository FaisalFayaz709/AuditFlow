import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import { loadEntityInTenantScope, requireCompanyMembership, type CompanyMembershipLookup } from '../src/shared/tenant-boundary.js';
import type { CompanyMembershipRecord, TenantContext } from '../src/shared/tenant-context.js';

function membership(overrides: Partial<CompanyMembershipRecord> = {}): CompanyMembershipRecord {
  return {
    membershipId: 'membership_a',
    companyId: 'company_a',
    userId: 'user_a',
    role: 'OWNER',
    status: 'ACTIVE',
    ...overrides,
  };
}

function lookup(record: CompanyMembershipRecord | null): CompanyMembershipLookup {
  return {
    async findMembershipForUserCompany() {
      return record;
    },
  };
}

describe('tenant boundary helpers', () => {
  it('creates tenant context from an active company membership', async () => {
    const tenant = await requireCompanyMembership({
      lookup: lookup(membership()),
      userId: 'user_a',
      companyId: 'company_a',
    });

    expect(tenant).toEqual({
      companyId: 'company_a',
      userId: 'user_a',
      membershipId: 'membership_a',
      role: 'OWNER',
    });
  });

  it('rejects a missing membership', async () => {
    await expect(
      requireCompanyMembership({
        lookup: lookup(null),
        userId: 'user_a',
        companyId: 'company_b',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'TENANT_MEMBERSHIP_REQUIRED',
    });
  });

  it('rejects a disabled membership', async () => {
    await expect(
      requireCompanyMembership({
        lookup: lookup(membership({ status: 'DISABLED' })),
        userId: 'user_a',
        companyId: 'company_a',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'TENANT_MEMBERSHIP_INACTIVE',
    });
  });

  it('loads entities only through the tenant-scoped loader', async () => {
    const tenant: TenantContext = {
      companyId: 'company_a',
      userId: 'user_a',
      membershipId: 'membership_a',
      role: 'OWNER',
    };

    const entity = await loadEntityInTenantScope({
      tenant,
      entityType: 'company',
      entityId: 'company_a',
      load: async (tenantContext) => ({ id: tenantContext.companyId }),
    });

    expect(entity).toEqual({ id: 'company_a' });
  });

  it('returns tenant-safe not found when a scoped entity is absent', async () => {
    const tenant: TenantContext = {
      companyId: 'company_a',
      userId: 'user_a',
      membershipId: 'membership_a',
      role: 'OWNER',
    };

    await expect(
      loadEntityInTenantScope({
        tenant,
        entityType: 'evidence',
        entityId: 'foreign_evidence_id',
        load: async () => null,
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'EVIDENCE_NOT_FOUND',
    });
  });
});
