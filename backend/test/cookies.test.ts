import type { FastifyReply } from 'fastify';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';
import {
  parseCookies,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from '../src/shared/http-cookies.js';

describe('Pass 03 session cookie helpers', () => {
  it('parses auditflow_session from a Cookie header', () => {
    const parsed = parseCookies(`theme=dark; ${SESSION_COOKIE_NAME}=abc123; other=value`);
    expect(parsed[SESSION_COOKIE_NAME]).toBe('abc123');
  });

  it('derives cookie Max-Age from SESSION_ABSOLUTE_SECONDS instead of a hard-coded literal', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://auditflow:auditflow_dev_password@localhost:5432/auditflow_test',
      SESSION_ABSOLUTE_SECONDS: '12345',
    });
    const headers: Record<string, string> = {};
    const reply = {
      header(name: string, value: string) {
        headers[name] = value;
        return this;
      },
    } as unknown as FastifyReply;

    setSessionCookie(reply, 'session-token', env);

    expect(headers['Set-Cookie']).toContain(`${SESSION_COOKIE_NAME}=session-token`);
    expect(headers['Set-Cookie']).toContain('HttpOnly');
    expect(headers['Set-Cookie']).toContain('SameSite=Lax');
    expect(headers['Set-Cookie']).toContain('Max-Age=12345');
    expect(headers['Set-Cookie']).not.toContain('Max-Age=604800');
  });
});
