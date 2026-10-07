import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import { CompaniesService } from '../src/modules/companies/companies.service.js';
import type { CompanySummary } from '../src/modules/companies/companies.repository.js';
import type { TenantContext } from '../src/shared/tenant-context.js';

function tenant(role: TenantContext['role'] = 'OWNER'): TenantContext {
  return {
    companyId: 'company_a',
    userId: 'user_a',
    membershipId: 'membership_a',
    role,
  };
}

describe('company service tenant-scoped access', () => {
  it('reads a company only through tenant-scoped repository access', async () => {
    const service = new CompaniesService({
      async findCompanyInTenantScope(tenantContext): Promise<CompanySummary | null> {
        return {
          id: tenantContext.companyId,
          name: 'Company A',
          industry: null,
          website: null,
        };
      },
    });

    await expect(service.getCurrentCompany(tenant())).resolves.toEqual({
      id: 'company_a',
      name: 'Company A',
      industry: null,
      website: null,
    });
  });

  it('does not reveal whether a foreign company exists', async () => {
    const service = new CompaniesService({
      async findCompanyInTenantScope(): Promise<CompanySummary | null> {
        return null;
      },
    });

    await expect(service.getCurrentCompany(tenant())).rejects.toMatchObject({
      statusCode: 404,
      code: 'COMPANY_NOT_FOUND',
    });
  });
});
