import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_VERSION = 'scrypt-v1';
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_MIN_LENGTH = 12;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashOpaqueToken(token: string, pepper: string): string {
  return createHash('sha256').update(`${token}.${pepper}`).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }

  const salt = randomBytes(16).toString('base64url');
  const derivedKey = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return `${PASSWORD_HASH_VERSION}$${salt}$${derivedKey.toString('base64url')}`;
}

export async function verifyPassword(password: string, encodedHash: string | null | undefined): Promise<boolean> {
  if (!encodedHash) {
    return false;
  }

  const [version, salt, storedKey] = encodedHash.split('$');
  if (version !== PASSWORD_HASH_VERSION || !salt || !storedKey) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  const storedBuffer = Buffer.from(storedKey, 'base64url');

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, derivedKey);
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
