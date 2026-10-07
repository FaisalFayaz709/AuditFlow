import type { PrismaClient, Session } from '@prisma/client';
import type { AppEnv } from '../../config/env.js';
import { addSeconds, generateOpaqueToken, hashOpaqueToken } from '../../shared/crypto.js';
import { AppError } from '../../shared/errors.js';

export type CreatedSession = {
  sessionId: string;
  token: string;
  csrfToken: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
};

export type ResolvedSession = {
  sessionId: string;
  userId: string;
};

export class SessionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: AppEnv,
  ) {}

  async createSession(params: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    now?: Date;
  }): Promise<CreatedSession> {
    const now = params.now ?? new Date();
    const token = generateOpaqueToken(32);
    const csrfToken = generateOpaqueToken(32);
    const idleExpiresAt = addSeconds(now, this.env.SESSION_IDLE_SECONDS);
    const absoluteExpiresAt = addSeconds(now, this.env.SESSION_ABSOLUTE_SECONDS);

    const session = await this.prisma.session.create({
      data: {
        user_id: params.userId,
        token_hash: hashOpaqueToken(token, this.env.SESSION_PEPPER),
        expires_at: absoluteExpiresAt,
        idle_expires_at: idleExpiresAt,
        absolute_expires_at: absoluteExpiresAt,
        last_seen_at: now,
        csrf_token_hash: hashOpaqueToken(csrfToken, this.env.SESSION_PEPPER),
        csrf_token_issued_at: now,
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
      },
      select: { id: true },
    });

    return {
      sessionId: session.id,
      token,
      csrfToken,
      idleExpiresAt,
      absoluteExpiresAt,
    };
  }

  async resolveSession(token: string | undefined, now = new Date()): Promise<ResolvedSession | null> {
    if (!token) {
      return null;
    }

    const tokenHash = hashOpaqueToken(token, this.env.SESSION_PEPPER);
    const session = await this.prisma.session.findUnique({
      where: { token_hash: tokenHash },
      select: {
        id: true,
        user_id: true,
        revoked_at: true,
        idle_expires_at: true,
        absolute_expires_at: true,
      },
    });

    if (!session || session.revoked_at) {
      return null;
    }

    if (session.idle_expires_at <= now || session.absolute_expires_at <= now) {
      await this.revokeSession(session.id, 'expired');
      return null;
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        last_seen_at: now,
        idle_expires_at: addSeconds(now, this.env.SESSION_IDLE_SECONDS),
      },
    });

    return { sessionId: session.id, userId: session.user_id };
  }

  async requireSession(token: string | undefined): Promise<ResolvedSession> {
    const session = await this.resolveSession(token);
    if (!session) {
      throw new AppError({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'A valid session is required.',
      });
    }
    return session;
  }

  async rotateSession(params: {
    sessionId: string;
    reason: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<CreatedSession> {
    const existing = await this.prisma.session.findUnique({
      where: { id: params.sessionId },
      select: { user_id: true, revoked_at: true },
    });

    if (!existing || existing.revoked_at) {
      throw new AppError({
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'A valid session is required.',
      });
    }

    await this.revokeSession(params.sessionId, params.reason);
    return this.createSession({
      userId: existing.user_id,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  async revokeSession(sessionId: string, reason = 'logout'): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revoked_at: null },
      data: { revoked_at: new Date(), revoked_reason: reason },
    });
  }

  async revokeAllUserSessions(userId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date(), revoked_reason: reason },
    });
  }

  async issueCsrfToken(sessionId: string): Promise<string> {
    const csrfToken = generateOpaqueToken(32);
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        csrf_token_hash: hashOpaqueToken(csrfToken, this.env.SESSION_PEPPER),
        csrf_token_issued_at: new Date(),
      },
    });
    return csrfToken;
  }

  async validateCsrfToken(sessionId: string, csrfToken: string | undefined): Promise<void> {
    if (!csrfToken) {
      throw new AppError({
        statusCode: 403,
        code: 'CSRF_TOKEN_REQUIRED',
        message: 'A CSRF token is required for this request.',
      });
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { csrf_token_hash: true, csrf_token_issued_at: true, revoked_at: true },
    });

    if (!session || session.revoked_at || !session.csrf_token_hash || !session.csrf_token_issued_at) {
      throw new AppError({
        statusCode: 403,
        code: 'CSRF_TOKEN_INVALID',
        message: 'The CSRF token is invalid.',
      });
    }

    const expiresAt = addSeconds(session.csrf_token_issued_at, this.env.CSRF_TOKEN_SECONDS);
    if (expiresAt <= new Date()) {
      throw new AppError({
        statusCode: 403,
        code: 'CSRF_TOKEN_EXPIRED',
        message: 'The CSRF token has expired.',
      });
    }

    if (hashOpaqueToken(csrfToken, this.env.SESSION_PEPPER) !== session.csrf_token_hash) {
      throw new AppError({
        statusCode: 403,
        code: 'CSRF_TOKEN_INVALID',
        message: 'The CSRF token is invalid.',
      });
    }
  }

  static isActive(session: Pick<Session, 'revoked_at' | 'idle_expires_at' | 'absolute_expires_at'>, now = new Date()): boolean {
    return !session.revoked_at && session.idle_expires_at > now && session.absolute_expires_at > now;
  }
}
