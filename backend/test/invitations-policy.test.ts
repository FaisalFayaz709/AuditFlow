import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import { assertInvitationActive, isInvitationExpired } from '../src/modules/invitations/invitations.service.js';
import { InviteMemberBodySchema } from '../src/modules/invitations/invitations.schemas.js';

describe('Pass 04 invitation lifecycle guards', () => {
  it('treats expires_at at or before now as expired', () => {
    const now = new Date('2026-08-08T10:00:00.000Z');
    expect(isInvitationExpired(new Date('2026-08-08T10:00:00.000Z'), now)).toBe(true);
    expect(isInvitationExpired(new Date('2026-08-08T10:00:01.000Z'), now)).toBe(false);
  });

  it('rejects non-pending invitations for use', () => {
    expect(() => assertInvitationActive({
      status: 'REVOKED',
      expiresAt: new Date('2026-08-09T10:00:00.000Z'),
      now: new Date('2026-08-08T10:00:00.000Z'),
    })).toThrow(AppError);
  });

  it('rejects expired pending invitations', () => {
    expect(() => assertInvitationActive({
      status: 'PENDING',
      expiresAt: new Date('2026-08-07T10:00:00.000Z'),
      now: new Date('2026-08-08T10:00:00.000Z'),
    })).toThrow(AppError);
  });

  it('does not allow owner invitations in Pass 04 because owner-transfer workflow is not yet implemented', () => {
    const parsed = InviteMemberBodySchema.safeParse({ email: 'new@example.com', role: 'OWNER' });
    expect(parsed.success).toBe(false);
  });
});
