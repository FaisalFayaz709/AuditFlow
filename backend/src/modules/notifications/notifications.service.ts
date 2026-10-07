import type { NotificationPreferenceCategory, NotificationType, PrismaClient } from '@prisma/client';
import type { AppEnv } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { requirePermission } from '../authz/permissions.js';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { NotificationListQuery, NotificationPreferenceUpdate } from './notifications.schemas.js';
import { createNotificationEmailProvider } from './notification-provider.factory.js';
import {
  NOTIFICATION_DELIVERY_CONTRACT_VERSION,
  PASS_54_JOBS_NOTIFICATIONS_RUNTIME_VERSION,
  PASS_35_NOTIFICATION_EVENT_CATALOG,
  assertNoRestrictedNotificationPayload,
  buildMinimalEmailBody,
  isMandatoryNotificationType,
  nextNotificationAttemptAt,
  notificationPreferenceCategoryForType,
  sanitizeNotificationActionUrl,
} from './notification-policy.js';

export type NotificationAuditContext = {
  requestId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export class NotificationsService {
  constructor(private readonly prisma: PrismaClient, private readonly env: AppEnv) {}

  async listForUser(params: { tenant: TenantContext; query: NotificationListQuery }) {
    requirePermission(params.tenant, 'notifications.read');
    const skip = (params.query.page - 1) * params.query.limit;
    const where = {
      company_id: params.tenant.companyId,
      user_id: params.tenant.userId,
      ...(params.query.status ? { status: params.query.status } : {}),
      ...(params.query.unreadOnly ? { read_at: null } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip, take: params.query.limit }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, pagination: { page: params.query.page, limit: params.query.limit, total, totalPages: Math.max(1, Math.ceil(total / params.query.limit)) } };
  }

  async markRead(params: { tenant: TenantContext; notificationId: string; audit?: NotificationAuditContext }) {
    requirePermission(params.tenant, 'notifications.read');
    const notification = await this.prisma.notification.findFirst({
      where: { id: params.notificationId, company_id: params.tenant.companyId, user_id: params.tenant.userId },
    });
    if (!notification) throw new AppError({ statusCode: 404, code: 'NOTIFICATION_NOT_FOUND', message: 'Notification was not found.' });
    const updated = await this.prisma.notification.update({ where: { id: notification.id }, data: { read_at: new Date() } });
    if (params.audit) {
      await new AuditLogService(this.prisma).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'NOTIFICATION_READ',
        entityType: 'notification',
        entityId: updated.id,
        metadata: { type: updated.type, status: updated.status, contractVersion: NOTIFICATION_DELIVERY_CONTRACT_VERSION },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });
    }
    return updated;
  }

  async listPreferences(params: { tenant: TenantContext }) {
    requirePermission(params.tenant, 'notifications.read');
    const saved = await this.prisma.notificationPreference.findMany({
      where: { company_id: params.tenant.companyId, user_id: params.tenant.userId },
      orderBy: [{ category: 'asc' }, { type: 'asc' }],
    });
    return {
      contractVersion: NOTIFICATION_DELIVERY_CONTRACT_VERSION,
      mandatoryTypes: PASS_35_NOTIFICATION_EVENT_CATALOG.filter(isMandatoryNotificationType),
      preferences: saved,
      catalog: PASS_35_NOTIFICATION_EVENT_CATALOG.map((type) => ({
        type,
        category: notificationPreferenceCategoryForType(type),
        mandatory: isMandatoryNotificationType(type),
      })),
    };
  }

  async updatePreferences(params: { tenant: TenantContext; body: NotificationPreferenceUpdate; audit: NotificationAuditContext }) {
    requirePermission(params.tenant, 'notifications.read');
    const updated = [];
    for (const pref of params.body.preferences) {
      const type = pref.type ?? null;
      if (type && isMandatoryNotificationType(type) && pref.enabled === false) {
        throw new AppError({ statusCode: 422, code: 'MANDATORY_NOTIFICATION_CANNOT_BE_DISABLED', message: 'Account/security and invitation notifications cannot be disabled.' });
      }
      if (!type && ['ACCOUNT_SECURITY', 'INVITATION'].includes(pref.category) && pref.enabled === false) {
        throw new AppError({ statusCode: 422, code: 'MANDATORY_NOTIFICATION_CANNOT_BE_DISABLED', message: 'Account/security and invitation notification categories cannot be disabled.' });
      }
      const existing = await this.prisma.notificationPreference.findFirst({
        where: { company_id: params.tenant.companyId, user_id: params.tenant.userId, category: pref.category, type, channel: pref.channel },
      });
      const record = existing
        ? await this.prisma.notificationPreference.update({ where: { id: existing.id }, data: { enabled: pref.enabled } })
        : await this.prisma.notificationPreference.create({ data: { company_id: params.tenant.companyId, user_id: params.tenant.userId, category: pref.category, type, channel: pref.channel, enabled: pref.enabled } });
      updated.push(record);
    }
    await new AuditLogService(this.prisma).recordEvent({
      tenant: params.tenant,
      sessionId: params.audit.sessionId,
      action: 'NOTIFICATION_PREFERENCES_UPDATED',
      entityType: 'notification_preferences',
      entityId: params.tenant.userId,
      metadata: { changed: updated.length, contractVersion: NOTIFICATION_DELIVERY_CONTRACT_VERSION },
      actorSnapshot: { role: params.tenant.role },
      ipAddress: params.audit.ipAddress,
      userAgent: params.audit.userAgent,
      requestId: params.audit.requestId,
    });
    return { contractVersion: NOTIFICATION_DELIVERY_CONTRACT_VERSION, preferences: updated };
  }

  async createNotification(params: {
    companyId: string;
    userId: string;
    type: NotificationType;
    subject: string;
    body: string;
    entityType?: string;
    entityId?: string;
    dedupKey?: string;
    scheduledAt?: Date;
    actionUrl?: string;
    sensitiveContent?: boolean;
  }) {
    const category = notificationPreferenceCategoryForType(params.type);
    const safeActionUrl = sanitizeNotificationActionUrl(params.actionUrl);
    assertNoRestrictedNotificationPayload({ subject: params.subject, body: params.body, actionUrl: params.actionUrl });

    const suppressed = await this.shouldSuppressNotification({ companyId: params.companyId, userId: params.userId, type: params.type, category });
    const data = {
      company_id: params.companyId,
      user_id: params.userId,
      type: params.type,
      preference_category: category,
      entity_type: params.entityType,
      entity_id: params.entityId,
      channel: this.env.NOTIFICATION_DEFAULT_CHANNEL,
      status: suppressed ? 'SUPPRESSED' as const : 'PENDING' as const,
      dedup_key: params.dedupKey,
      subject: params.subject,
      body: params.body,
      action_url: safeActionUrl,
      sensitive_content: Boolean(params.sensitiveContent),
      scheduled_at: params.scheduledAt,
      next_attempt_at: params.scheduledAt,
    };

    if (!params.dedupKey) return this.prisma.notification.create({ data });

    const existing = await this.prisma.notification.findFirst({
      where: { company_id: params.companyId, user_id: params.userId, dedup_key: params.dedupKey },
    });
    if (existing) return existing;
    return this.prisma.notification.create({ data });
  }

  async deliverPending(limit = 100, companyId?: string) {
    const now = new Date();
    const take = Math.min(Math.max(1, limit), 500);
    const lockCutoff = new Date(now.getTime() - this.env.NOTIFICATION_DELIVERY_LOCK_SECONDS * 1000);
    const pending = await this.prisma.notification.findMany({
      where: {
        status: 'PENDING',
        ...(companyId ? { company_id: companyId } : {}),
        OR: [{ scheduled_at: null }, { scheduled_at: { lte: now } }],
        AND: [{ OR: [{ next_attempt_at: null }, { next_attempt_at: { lte: now } }] }, { OR: [{ delivery_locked_at: null }, { delivery_locked_at: { lt: lockCutoff } }] }],
      },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      take,
    });
    const provider = createNotificationEmailProvider(this.env);
    let sent = 0;
    let failed = 0;
    let permanentFailures = 0;
    let considered = 0;
    for (const notification of pending) {
      const claimed = await this.prisma.notification.updateMany({
        where: { id: notification.id, status: 'PENDING', ...(companyId ? { company_id: companyId } : {}), OR: [{ delivery_locked_at: null }, { delivery_locked_at: { lt: lockCutoff } }] },
        data: { delivery_locked_at: now },
      });
      if (claimed.count !== 1) continue;
      considered += 1;
      const attemptNo = notification.attempt_count + 1;
      try {
        const safeEmailBody = buildMinimalEmailBody({ body: notification.body, actionUrl: notification.action_url, sensitiveContent: notification.sensitive_content });
        assertNoRestrictedNotificationPayload({ subject: notification.subject, body: safeEmailBody, actionUrl: notification.action_url });
        const result = await provider.send({
          toUserId: notification.user_id,
          subject: notification.subject,
          body: safeEmailBody,
          actionUrl: sanitizeNotificationActionUrl(notification.action_url),
        });
        await this.prisma.$transaction([
          this.prisma.notificationDelivery.create({
            data: { notification_id: notification.id, attempt_no: attemptNo, provider_message_id: result.providerMessageId, status: 'SENT', completed_at: now },
          }),
          this.prisma.notification.update({ where: { id: notification.id }, data: { status: 'SENT', sent_at: now, attempt_count: attemptNo, last_error: null, delivery_locked_at: null } }),
        ]);
        sent += 1;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown delivery failure';
        const reachedMaxAttempts = attemptNo >= this.env.NOTIFICATION_MAX_ATTEMPTS;
        const nextAttempt = reachedMaxAttempts ? null : nextNotificationAttemptAt(now, { attemptNo, baseSeconds: this.env.NOTIFICATION_BASE_BACKOFF_SECONDS, maxSeconds: this.env.NOTIFICATION_MAX_BACKOFF_SECONDS });
        await this.prisma.$transaction([
          this.prisma.notificationDelivery.create({
            data: {
              notification_id: notification.id,
              attempt_no: attemptNo,
              status: reachedMaxAttempts ? 'PERMANENT_FAILURE' : 'FAILED',
              last_error: errorMessage,
              next_attempt_at: nextAttempt,
              completed_at: now,
            },
          }),
          this.prisma.notification.update({
            where: { id: notification.id },
            data: { status: reachedMaxAttempts ? 'FAILED' : 'PENDING', attempt_count: attemptNo, last_error: errorMessage, next_attempt_at: nextAttempt, delivery_locked_at: null },
          }),
        ]);
        if (reachedMaxAttempts) permanentFailures += 1;
        failed += 1;
      }
    }
    return { considered, sent, failed, permanentFailures, companyId: companyId ?? null, contractVersion: NOTIFICATION_DELIVERY_CONTRACT_VERSION, runtimeVersion: PASS_54_JOBS_NOTIFICATIONS_RUNTIME_VERSION };
  }

  private async shouldSuppressNotification(params: { companyId: string; userId: string; type: NotificationType; category: NotificationPreferenceCategory }) {
    if (isMandatoryNotificationType(params.type)) return false;
    const typePreference = await this.prisma.notificationPreference.findFirst({
      where: { company_id: params.companyId, user_id: params.userId, type: params.type, channel: this.env.NOTIFICATION_DEFAULT_CHANNEL },
    });
    if (typePreference) return !typePreference.enabled;
    const categoryPreference = await this.prisma.notificationPreference.findFirst({
      where: { company_id: params.companyId, user_id: params.userId, category: params.category, type: null, channel: this.env.NOTIFICATION_DEFAULT_CHANNEL },
    });
    return categoryPreference ? !categoryPreference.enabled : false;
  }
}
