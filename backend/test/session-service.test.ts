import { describe, expect, it } from 'vitest';
import { SessionService } from '../src/modules/auth/session.service.js';

describe('Pass 03 session state predicate', () => {
  it('treats non-revoked sessions within both expiry windows as active', () => {
    const now = new Date('2026-08-08T10:00:00.000Z');
    expect(SessionService.isActive({
      revoked_at: null,
      idle_expires_at: new Date('2026-08-08T11:00:00.000Z'),
      absolute_expires_at: new Date('2026-08-15T10:00:00.000Z'),
    }, now)).toBe(true);
  });

  it('treats revoked or expired sessions as inactive', () => {
    const now = new Date('2026-08-08T10:00:00.000Z');
    expect(SessionService.isActive({
      revoked_at: new Date('2026-08-08T09:00:00.000Z'),
      idle_expires_at: new Date('2026-08-08T11:00:00.000Z'),
      absolute_expires_at: new Date('2026-08-15T10:00:00.000Z'),
    }, now)).toBe(false);

    expect(SessionService.isActive({
      revoked_at: null,
      idle_expires_at: new Date('2026-08-08T09:59:59.000Z'),
      absolute_expires_at: new Date('2026-08-15T10:00:00.000Z'),
    }, now)).toBe(false);
  });
});
