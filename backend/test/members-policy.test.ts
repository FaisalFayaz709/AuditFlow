import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import { assertMemberRemovalAllowed, assertRoleChangeAllowed } from '../src/modules/companies/companies.service.js';

describe('Pass 04 member administration policy guards', () => {
  it('prevents demoting the final active OWNER', () => {
    expect(() => assertRoleChangeAllowed({
      actorRole: 'OWNER',
      targetRole: 'OWNER',
      nextRole: 'ADMIN',
      targetStatus: 'ACTIVE',
      activeOwnerCount: 1,
    })).toThrow(AppError);
  });

  it('prevents removing the final active OWNER', () => {
    expect(() => assertMemberRemovalAllowed({
      targetRole: 'OWNER',
      targetStatus: 'ACTIVE',
      activeOwnerCount: 1,
    })).toThrow(AppError);
  });

  it('prevents ADMIN from granting OWNER role', () => {
    expect(() => assertRoleChangeAllowed({
      actorRole: 'ADMIN',
      targetRole: 'MEMBER',
      nextRole: 'OWNER',
      targetStatus: 'ACTIVE',
      activeOwnerCount: 2,
    })).toThrow(AppError);
  });

  it('allows OWNER to grant OWNER role when target membership is active', () => {
    expect(() => assertRoleChangeAllowed({
      actorRole: 'OWNER',
      targetRole: 'ADMIN',
      nextRole: 'OWNER',
      targetStatus: 'ACTIVE',
      activeOwnerCount: 1,
    })).not.toThrow();
  });
});
