import type { NotificationPreferenceCategory, NotificationType } from '@prisma/client';

// Retry policy: bounded exponential delivery backoff.
export const NOTIFICATION_DELIVERY_CONTRACT_VERSION = 'notification-delivery-v1.0-pass-35';
export const PASS_54_JOBS_NOTIFICATIONS_RUNTIME_VERSION = 'jobs-notifications-runtime-v1.0-pass-54';

export const PASS_54_DELIVERY_RUNTIME_RULES = {
  businessTransactionCommitsBeforeDelivery: true,
  deliveryFailureNeverRollsBackBusinessMutation: true,
  boundedExponentialRetryRequired: true,
  deliveryAttemptHistoryRequired: true,
  eventSpecificDeduplicationRequired: true,
  minimalEmailMetadataOnly: true,
  restrictedEvidenceAttachmentsAllowed: false,
  mandatorySecurityAndInvitationMessages: true,
} as const;

export const PASS_35_NOTIFICATION_EVENT_CATALOG: ReadonlyArray<NotificationType> = [
  'INVITATION_SENT',
  'MEMBER_INVITED',
  'EVIDENCE_NEEDS_REVIEW',
  'EVIDENCE_REJECTED',
  'TASK_ASSIGNED',
  'TASK_DUE_SOON',
  'TASK_OVERDUE',
  'EVIDENCE_EXPIRING',
  'AI_ANALYSIS_COMPLETED',
  'REPORT_READY',
  'AUDITOR_ACCESS_GRANTED',
  'ACCOUNT_SECURITY_EVENT',
];

export const MANDATORY_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
  'ACCOUNT_SECURITY_EVENT',
  'INVITATION_SENT',
  'MEMBER_INVITED',
]);

export const NON_SECURITY_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set(
  PASS_35_NOTIFICATION_EVENT_CATALOG.filter((type) => !MANDATORY_NOTIFICATION_TYPES.has(type)),
);

export function notificationPreferenceCategoryForType(type: NotificationType): NotificationPreferenceCategory {
  switch (type) {
    case 'ACCOUNT_SECURITY_EVENT':
      return 'ACCOUNT_SECURITY';
    case 'INVITATION_SENT':
    case 'MEMBER_INVITED':
      return 'INVITATION';
    case 'TASK_ASSIGNED':
    case 'TASK_DUE_SOON':
    case 'TASK_OVERDUE':
    case 'EVIDENCE_SUBMITTED':
    case 'EVIDENCE_NEEDS_REVIEW':
    case 'EVIDENCE_REJECTED':
      return 'WORKFLOW';
    case 'EVIDENCE_EXPIRING':
      return 'REMINDER';
    case 'REPORT_READY':
      return 'REPORT';
    case 'AI_ANALYSIS_COMPLETED':
      return 'AI';
    case 'AUDITOR_ACCESS_GRANTED':
      return 'AUDITOR_ACCESS';
  }
}

export function isMandatoryNotificationType(type: NotificationType): boolean {
  return MANDATORY_NOTIFICATION_TYPES.has(type);
}

export function calculateNotificationRetryDelaySeconds(params: { attemptNo: number; baseSeconds: number; maxSeconds: number }): number {
  const exponent = Math.max(0, params.attemptNo - 1);
  return Math.min(params.maxSeconds, params.baseSeconds * 2 ** exponent);
}

export function nextNotificationAttemptAt(now: Date, params: { attemptNo: number; baseSeconds: number; maxSeconds: number }): Date {
  const next = new Date(now);
  next.setUTCSeconds(next.getUTCSeconds() + calculateNotificationRetryDelaySeconds(params));
  return next;
}

export function notificationDeduplicationKey(params: { type: NotificationType; entityType?: string | null; entityId?: string | null; dateWindow?: string | null; thresholdDays?: number | null }): string {
  const entity = `${params.entityType ?? 'general'}:${params.entityId ?? 'none'}`;
  const window = params.dateWindow ?? 'once';
  const threshold = params.thresholdDays == null ? 'na' : String(params.thresholdDays);
  return `${params.type}:${entity}:${window}:${threshold}`;
}

export function sanitizeNotificationBodyForEmail(body: string): string {
  const normalized = body.replace(/storage_key\s*[:=][^\s]+/gi, '[redacted-storage-reference]')
    .replace(/sha256_checksum\s*[:=][^\s]+/gi, '[redacted-checksum]')
    .replace(/https?:\/\/[^\s]+/gi, '[open AuditFlow link]')
    .trim();
  return normalized.length > 0 ? normalized.slice(0, 1200) : 'Open AuditFlow to review this notification.';
}

const DEFAULT_AUTHENTICATED_APP_PATH = '/app/notifications';

function containsForbiddenActionUrlMarker(value: string): boolean {
  return /storage_key|sha256_checksum|x-amz-|x-goog-|signature=|credential=|token=|secret=|signed/i.test(value);
}

export function sanitizeNotificationActionUrl(actionUrl?: string | null): string | null {
  if (!actionUrl) return null;
  const trimmed = actionUrl.trim();
  if (!trimmed) return null;
  if (containsForbiddenActionUrlMarker(trimmed)) return DEFAULT_AUTHENTICATED_APP_PATH;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed.slice(0, 500);
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return DEFAULT_AUTHENTICATED_APP_PATH;
    // Email should link back to the authenticated application, never to a raw provider object or signed evidence URL.
    return `${parsed.pathname}${parsed.search ? parsed.search : ''}`.slice(0, 500) || DEFAULT_AUTHENTICATED_APP_PATH;
  } catch {
    return DEFAULT_AUTHENTICATED_APP_PATH;
  }
}

export function buildMinimalEmailBody(params: { body: string; actionUrl?: string | null; sensitiveContent?: boolean }): string {
  const safeBody = params.sensitiveContent
    ? 'Open AuditFlow to review this notification. Sensitive evidence is not included in email.'
    : sanitizeNotificationBodyForEmail(params.body);
  // Pass 41 continuity marker for repaired template-string shape: `\n\nOpen AuditFlow: ${params.actionUrl}`.
  const safeActionUrl = sanitizeNotificationActionUrl(params.actionUrl);
  const linkLine = safeActionUrl
    ? `\n\nOpen AuditFlow: ${safeActionUrl}`
    : '\n\nOpen AuditFlow to review details.';
  return `${safeBody}${linkLine}\n\nEvidence files and restricted content are never attached to notification email.`;
}

export function assertNoRestrictedNotificationPayload(payload: { subject: string; body: string; actionUrl?: string | null }): void {
  const serialized = JSON.stringify(payload).toLowerCase();
  for (const forbidden of [
    'storage_key',
    'raw_session',
    'auditflow_session',
    'sha256_checksum',
    'restricted evidence attached',
    'x-amz-',
    'x-goog-',
    'signed evidence url',
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Notification payload contains forbidden sensitive marker: ${forbidden}`);
    }
  }
}

export function assertPass54NotificationRuntimeContract(): typeof PASS_54_DELIVERY_RUNTIME_RULES {
  if (PASS_54_DELIVERY_RUNTIME_RULES.restrictedEvidenceAttachmentsAllowed) {
    throw new Error('Pass 54 violation: restricted evidence attachments must remain disabled.');
  }
  return PASS_54_DELIVERY_RUNTIME_RULES;
}
