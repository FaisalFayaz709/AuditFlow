import { z } from 'zod';

export const NotificationListQuerySchema = z.object({
  status: z.enum(['PENDING', 'SENT', 'FAILED', 'CANCELLED', 'SUPPRESSED']).optional(),
  unreadOnly: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export const NotificationIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const NotificationPreferenceUpdateSchema = z.object({
  preferences: z.array(z.object({
    category: z.enum(['ACCOUNT_SECURITY', 'INVITATION', 'WORKFLOW', 'REMINDER', 'REPORT', 'AI', 'AUDITOR_ACCESS']),
    type: z.enum([
      'MEMBER_INVITED',
      'INVITATION_SENT',
      'TASK_ASSIGNED',
      'TASK_DUE_SOON',
      'TASK_OVERDUE',
      'EVIDENCE_SUBMITTED',
      'EVIDENCE_NEEDS_REVIEW',
      'EVIDENCE_REJECTED',
      'EVIDENCE_EXPIRING',
      'AI_ANALYSIS_COMPLETED',
      'REPORT_READY',
      'AUDITOR_ACCESS_GRANTED',
      'ACCOUNT_SECURITY_EVENT',
    ]).optional().nullable(),
    channel: z.enum(['EMAIL']).default('EMAIL'),
    enabled: z.boolean(),
  })).min(1).max(50),
});

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;
export type NotificationPreferenceUpdate = z.infer<typeof NotificationPreferenceUpdateSchema>;
