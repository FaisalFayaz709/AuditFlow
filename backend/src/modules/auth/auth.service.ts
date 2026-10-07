import type { PrismaClient } from '@prisma/client';
import type { AppEnv } from '../../config/env.js';
import { addSeconds, generateOpaqueToken, hashOpaqueToken, hashPassword, normalizeEmail, verifyPassword } from '../../shared/crypto.js';
import { AppError } from '../../shared/errors.js';
import type { LoginBody, RegisterBody, ResetPasswordBody, VerifyEmailBody } from './auth.schemas.js';
import { SessionService, type CreatedSession } from './session.service.js';

export type AuthSessionPayload = {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerifiedAt: string | null;
  };
  memberships: Array<{
    id: string;
    companyId: string;
    companyName: string;
    role: string;
    status: string;
  }>;
  session: {
    id: string;
    idleExpiresAt: string;
    absoluteExpiresAt: string;
  };
  csrfToken: string;
};

export class AuthService {
  private readonly sessions: SessionService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: AppEnv,
  ) {
    this.sessions = new SessionService(prisma, env);
  }

  async register(input: RegisterBody & { ipAddress?: string; userAgent?: string; requestId: string }): Promise<AuthSessionPayload & { rawSessionToken: string; emailVerificationToken: string }> {
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);
    const emailVerificationToken = generateOpaqueToken(32);
    const emailVerificationTokenHash = hashOpaqueToken(emailVerificationToken, this.env.SESSION_PEPPER);
    const emailVerificationExpiresAt = addSeconds(new Date(), this.env.EMAIL_VERIFICATION_TOKEN_SECONDS);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        throw new AppError({
          statusCode: 409,
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'A user with this email already exists.',
          details: [{ field: 'email', reason: 'unique' }],
        });
      }

      const user = await tx.user.create({
        data: {
          name: input.name.trim(),
          email,
          password_hash: passwordHash,
        },
      });

      const company = await tx.company.create({
        data: {
          name: input.companyName.trim(),
        },
      });

      const membership = await tx.companyMember.create({
        data: {
          user_id: user.id,
          company_id: company.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      await tx.emailVerificationToken.create({
        data: {
          user_id: user.id,
          token_hash: emailVerificationTokenHash,
          expires_at: emailVerificationExpiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          company_id: company.id,
          user_id: user.id,
          action: 'AUTH_REGISTERED',
          entity_type: 'user',
          entity_id: user.id,
          metadata_json: { initialCompanyId: company.id },
          actor_snapshot_json: { email: user.email, name: user.name, role: 'OWNER' },
          ip_address: input.ipAddress,
          user_agent: input.userAgent,
          request_id: input.requestId,
        },
      });

      return { user, company, membership };
    });

    const session = await this.sessions.createSession({
      userId: result.user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      ...(await this.toSessionPayload(result.user.id, session)),
      rawSessionToken: session.token,
      emailVerificationToken,
    };
  }

  async login(input: LoginBody & { ipAddress?: string; userAgent?: string; requestId: string }): Promise<AuthSessionPayload & { rawSessionToken: string }> {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password_hash: true,
        status: true,
        memberships: {
          where: { status: 'ACTIVE' },
          select: { company_id: true, role: true },
          take: 1,
        },
      },
    });

    const passwordValid = await verifyPassword(input.password, user?.password_hash);
    if (!user || user.status !== 'ACTIVE' || !passwordValid) {
      throw new AppError({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'The email or password is invalid.',
      });
    }

    const session = await this.sessions.createSession({
      userId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    const firstMembership = user.memberships[0];
    if (firstMembership) {
      await this.prisma.auditLog.create({
        data: {
          company_id: firstMembership.company_id,
          user_id: user.id,
          session_id: session.sessionId,
          action: 'AUTH_LOGIN_SUCCEEDED',
          entity_type: 'session',
          entity_id: session.sessionId,
          metadata_json: {},
          actor_snapshot_json: { email: user.email, name: user.name, role: firstMembership.role },
          ip_address: input.ipAddress,
          user_agent: input.userAgent,
          request_id: input.requestId,
        },
      });
    }

    return {
      ...(await this.toSessionPayload(user.id, session)),
      rawSessionToken: session.token,
    };
  }

  async logout(params: { sessionId: string }): Promise<void> {
    await this.sessions.revokeSession(params.sessionId, 'logout');
  }

  async me(userId: string, sessionId: string): Promise<Omit<AuthSessionPayload, 'csrfToken'>> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        idle_expires_at: true,
        absolute_expires_at: true,
      },
    });

    if (!session) {
      throw new AppError({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED', message: 'A valid session is required.' });
    }

    const payload = await this.toSessionPayload(userId, {
      sessionId: session.id,
      token: '',
      csrfToken: '',
      idleExpiresAt: session.idle_expires_at,
      absoluteExpiresAt: session.absolute_expires_at,
    });

    const { csrfToken: _csrfToken, ...withoutCsrf } = payload;
    return withoutCsrf;
  }

  async issueCsrfToken(sessionId: string): Promise<string> {
    return this.sessions.issueCsrfToken(sessionId);
  }

  async changePassword(params: { userId: string; currentPassword: string; newPassword: string }): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true, password_hash: true },
    });

    const valid = await verifyPassword(params.currentPassword, user?.password_hash);
    if (!user || !valid) {
      throw new AppError({
        statusCode: 403,
        code: 'CURRENT_PASSWORD_INVALID',
        message: 'The current password is invalid.',
      });
    }

    const passwordHash = await hashPassword(params.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { password_hash: passwordHash } }),
      this.prisma.session.updateMany({
        where: { user_id: user.id, revoked_at: null },
        data: { revoked_at: new Date(), revoked_reason: 'password_changed' },
      }),
    ]);
  }

  async forgotPassword(emailInput: string): Promise<{ devResetToken?: string }> {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, status: true } });

    if (!user || user.status !== 'ACTIVE') {
      return {};
    }

    const token = generateOpaqueToken(32);
    await this.prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: hashOpaqueToken(token, this.env.SESSION_PEPPER),
        expires_at: addSeconds(new Date(), this.env.PASSWORD_RESET_TOKEN_SECONDS),
      },
    });

    return this.env.NODE_ENV === 'production' ? {} : { devResetToken: token };
  }

  async resetPassword(input: ResetPasswordBody): Promise<void> {
    const tokenHash = hashOpaqueToken(input.token, this.env.SESSION_PEPPER);
    const reset = await this.prisma.passwordResetToken.findUnique({
      where: { token_hash: tokenHash },
      select: { id: true, user_id: true, expires_at: true, used_at: true },
    });

    if (!reset || reset.used_at || reset.expires_at <= new Date()) {
      throw new AppError({
        statusCode: 422,
        code: 'PASSWORD_RESET_TOKEN_INVALID',
        message: 'The password reset token is invalid or expired.',
      });
    }

    const passwordHash = await hashPassword(input.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.user_id }, data: { password_hash: passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: reset.id }, data: { used_at: new Date() } }),
      this.prisma.session.updateMany({
        where: { user_id: reset.user_id, revoked_at: null },
        data: { revoked_at: new Date(), revoked_reason: 'password_reset' },
      }),
    ]);
  }

  async verifyEmail(input: VerifyEmailBody): Promise<void> {
    const tokenHash = hashOpaqueToken(input.token, this.env.SESSION_PEPPER);
    const verification = await this.prisma.emailVerificationToken.findUnique({
      where: { token_hash: tokenHash },
      select: { id: true, user_id: true, expires_at: true, used_at: true },
    });

    if (!verification || verification.used_at || verification.expires_at <= new Date()) {
      throw new AppError({
        statusCode: 422,
        code: 'EMAIL_VERIFICATION_TOKEN_INVALID',
        message: 'The email verification token is invalid or expired.',
      });
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: verification.user_id }, data: { email_verified_at: new Date() } }),
      this.prisma.emailVerificationToken.update({ where: { id: verification.id }, data: { used_at: new Date() } }),
    ]);
  }

  private async toSessionPayload(userId: string, session: CreatedSession): Promise<AuthSessionPayload> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        email_verified_at: true,
        memberships: {
          orderBy: { created_at: 'asc' },
          select: {
            id: true,
            company_id: true,
            role: true,
            status: true,
            company: { select: { name: true } },
          },
        },
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerifiedAt: user.email_verified_at?.toISOString() ?? null,
      },
      memberships: user.memberships.map((membership) => ({
        id: membership.id,
        companyId: membership.company_id,
        companyName: membership.company.name,
        role: membership.role,
        status: membership.status,
      })),
      session: {
        id: session.sessionId,
        idleExpiresAt: session.idleExpiresAt.toISOString(),
        absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
      },
      csrfToken: session.csrfToken,
    };
  }
}
