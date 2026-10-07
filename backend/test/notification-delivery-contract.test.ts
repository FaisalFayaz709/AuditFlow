import { describe, expect, it } from 'vitest';
import {
  MANDATORY_NOTIFICATION_TYPES,
  NON_SECURITY_NOTIFICATION_TYPES,
  PASS_35_NOTIFICATION_EVENT_CATALOG,
  assertNoRestrictedNotificationPayload,
  buildMinimalEmailBody,
  calculateNotificationRetryDelaySeconds,
  isMandatoryNotificationType,
  notificationPreferenceCategoryForType,
} from '../src/modules/notifications/notification-policy';
import { NotificationPreferenceUpdateSchema } from '../src/modules/notifications/notifications.schemas';

// Pass 35 tests encode the v2.1 delivery contract. Full database delivery tests run in integration suites.
describe('Pass 35 notification delivery contract', () => {
  it('documents required notification events and mandatory categories', () => {
    expect(PASS_35_NOTIFICATION_EVENT_CATALOG).toEqual(expect.arrayContaining([
      'INVITATION_SENT',
      'EVIDENCE_NEEDS_REVIEW',
      'EVIDENCE_REJECTED',
      'TASK_ASSIGNED',
      'TASK_OVERDUE',
      'EVIDENCE_EXPIRING',
      'REPORT_READY',
      'AUDITOR_ACCESS_GRANTED',
      'ACCOUNT_SECURITY_EVENT',
    ]));
    expect(MANDATORY_NOTIFICATION_TYPES.has('ACCOUNT_SECURITY_EVENT')).toBe(true);
    expect(MANDATORY_NOTIFICATION_TYPES.has('INVITATION_SENT')).toBe(true);
    expect(NON_SECURITY_NOTIFICATION_TYPES.has('TASK_OVERDUE')).toBe(true);
    expect(isMandatoryNotificationType('TASK_OVERDUE')).toBe(false);
  });

  it('maps notification types to preference categories', () => {
    expect(notificationPreferenceCategoryForType('ACCOUNT_SECURITY_EVENT')).toBe('ACCOUNT_SECURITY');
    expect(notificationPreferenceCategoryForType('INVITATION_SENT')).toBe('INVITATION');
    expect(notificationPreferenceCategoryForType('EVIDENCE_EXPIRING')).toBe('REMINDER');
    expect(notificationPreferenceCategoryForType('REPORT_READY')).toBe('REPORT');
    expect(notificationPreferenceCategoryForType('AUDITOR_ACCESS_GRANTED')).toBe('AUDITOR_ACCESS');
  });

  it('uses bounded exponential retry delays', () => {
    expect(calculateNotificationRetryDelaySeconds({ attemptNo: 1, baseSeconds: 60, maxSeconds: 3600 })).toBe(60);
    expect(calculateNotificationRetryDelaySeconds({ attemptNo: 3, baseSeconds: 60, maxSeconds: 3600 })).toBe(240);
    expect(calculateNotificationRetryDelaySeconds({ attemptNo: 10, baseSeconds: 60, maxSeconds: 3600 })).toBe(3600);
  });

  it('keeps email body minimal and refuses restricted payload markers', () => {
    const body = buildMinimalEmailBody({ body: 'Evidence needs review.', actionUrl: '/evidence/ev_1', sensitiveContent: true });
    expect(body).toContain('Sensitive evidence is not included in email');
    expect(body).toContain('never attached');
    expect(body).not.toContain('storage_key');
    expect(() => assertNoRestrictedNotificationPayload({ subject: 'x', body: 'storage_key=s3-secret' })).toThrow(/forbidden sensitive marker/);
  });

  it('accepts preference updates for non-security categories', () => {
    expect(NotificationPreferenceUpdateSchema.parse({ preferences: [{ category: 'REMINDER', channel: 'EMAIL', enabled: false }] }).preferences[0].enabled).toBe(false);
  });
});
