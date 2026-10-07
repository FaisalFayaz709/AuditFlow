import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import { assertCompanyControlStateAllowed } from '../src/modules/controls/controls.service.js';

describe('Pass 05 company control state rules', () => {
  it('requires a reason when marking a control not applicable', () => {
    expect(() =>
      assertCompanyControlStateAllowed({
        body: { applicability: 'NOT_APPLICABLE' },
        ownerMembership: null,
      }),
    ).toThrow(AppError);
  });

  it('requires owner to be an active company member', () => {
    expect(() =>
      assertCompanyControlStateAllowed({
        body: { ownerUserId: 'user_missing' },
        ownerMembership: null,
      }),
    ).toThrow(AppError);
  });

  it('allows assigning an active member as control owner', () => {
    expect(() =>
      assertCompanyControlStateAllowed({
        body: { ownerUserId: 'user_1' },
        ownerMembership: { user_id: 'user_1', role: 'MEMBER' },
      }),
    ).not.toThrow();
  });
});
