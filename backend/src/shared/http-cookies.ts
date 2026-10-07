import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppEnv } from '../config/env.js';

export const SESSION_COOKIE_NAME = 'auditflow_session';
export const SESSION_COOKIE_DEFAULT_SAMESITE = 'Lax';

export type SessionCookieAttributes = {
  name: typeof SESSION_COOKIE_NAME;
  httpOnly: true;
  secure: boolean;
  sameSite: typeof SESSION_COOKIE_DEFAULT_SAMESITE;
  path: '/';
  maxAge: number;
};

export function parseCookies(header: string | string[] | undefined): Record<string, string> {
  const raw = Array.isArray(header) ? header.join(';') : header;
  if (!raw) return {};

  return raw.split(';').reduce<Record<string, string>>((acc, part) => {
    const [name, ...valueParts] = part.trim().split('=');
    if (!name || valueParts.length === 0) return acc;
    acc[name] = decodeURIComponent(valueParts.join('='));
    return acc;
  }, {});
}

export function getSessionCookie(request: FastifyRequest): string | undefined {
  return parseCookies(request.headers.cookie)[SESSION_COOKIE_NAME];
}

export function getSessionCookieAttributes(env: AppEnv): SessionCookieAttributes {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: env.NODE_ENV === 'production' || env.NODE_ENV === 'staging',
    sameSite: SESSION_COOKIE_DEFAULT_SAMESITE,
    path: '/',
    maxAge: env.SESSION_ABSOLUTE_SECONDS,
  };
}

function serializeSessionCookie(value: string, attributes: SessionCookieAttributes): string {
  const parts = [
    `${attributes.name}=${encodeURIComponent(value)}`,
    'HttpOnly',
    `Path=${attributes.path}`,
    `SameSite=${attributes.sameSite}`,
    `Max-Age=${attributes.maxAge}`,
  ];

  if (attributes.secure) parts.push('Secure');
  return parts.join('; ');
}

export function setSessionCookie(reply: FastifyReply, token: string, env: AppEnv): void {
  reply.header('Set-Cookie', serializeSessionCookie(token, getSessionCookieAttributes(env)));
}

export function clearSessionCookie(reply: FastifyReply, env: AppEnv): void {
  reply.header('Set-Cookie', serializeSessionCookie('', {
    ...getSessionCookieAttributes(env),
    maxAge: 0,
  }));
}
