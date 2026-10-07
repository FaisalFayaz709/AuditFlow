import { describe, expect, it } from 'vitest';
import { generateOpaqueToken, hashOpaqueToken, hashPassword, normalizeEmail, verifyPassword } from '../src/shared/crypto.js';

describe('Pass 03 auth crypto', () => {
  it('normalizes email before identity lookup', () => {
    expect(normalizeEmail('  Faisal@Example.COM ')).toBe('faisal@example.com');
  });

  it('hashes opaque session tokens with a server pepper and does not reveal the raw token', () => {
    const token = generateOpaqueToken(32);
    const hash = hashOpaqueToken(token, 'pepper-pepper-pepper-pepper-pepper-123');

    expect(token).not.toContain(hash);
    expect(hash).toHaveLength(64);
    expect(hashOpaqueToken(token, 'pepper-pepper-pepper-pepper-pepper-123')).toBe(hash);
    expect(hashOpaqueToken(token, 'different-pepper-different-pepper-1234')).not.toBe(hash);
  });

  it('verifies scrypt password hashes and rejects the wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).toMatch(/^scrypt-v1\$/);
    expect(hash).not.toContain('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong horse battery staple', hash)).resolves.toBe(false);
  });
});
