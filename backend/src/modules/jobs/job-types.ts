export const auditFlowJobTypes = [
  'EXTRACT_EVIDENCE_TEXT',
  'RUN_AI_ANALYSIS',
  'GENERATE_REPORT',
  'EXPIRE_EVIDENCE',
  'SEND_TASK_REMINDER',
  'SEND_EXPIRY_ALERT',
  'MALWARE_SCAN',
  'CLEANUP_TEMP_UPLOADS',
  'RECONCILE_STORAGE_OBJECT',
  'PURGE_APPROVED_DELETION_REQUESTS',
  'DELIVER_NOTIFICATIONS',
] as const;

export type AuditFlowJobType = (typeof auditFlowJobTypes)[number];

export type AuditFlowJobPayload =
  | { type: 'EXTRACT_EVIDENCE_TEXT'; companyId: string; evidenceVersionId: string }
  | { type: 'RUN_AI_ANALYSIS'; companyId: string; evidenceVersionId: string; requestedByUserId: string }
  | { type: 'GENERATE_REPORT'; companyId: string; reportId: string }
  | { type: 'EXPIRE_EVIDENCE'; companyId?: string; asOf?: string }
  | { type: 'SEND_TASK_REMINDER'; companyId?: string; asOf?: string }
  | { type: 'SEND_EXPIRY_ALERT'; companyId?: string; thresholdDays?: number; asOf?: string }
  | { type: 'MALWARE_SCAN'; companyId: string; evidenceVersionId: string }
  | { type: 'CLEANUP_TEMP_UPLOADS'; companyId?: string; asOf?: string }
  | { type: 'RECONCILE_STORAGE_OBJECT'; companyId?: string; evidenceVersionId?: string }
  | { type: 'PURGE_APPROVED_DELETION_REQUESTS'; companyId?: string; asOf?: string }
  | { type: 'DELIVER_NOTIFICATIONS'; companyId?: string; limit?: number; asOf?: string };

export function jobPayloadDeduplicationKey(payload: AuditFlowJobPayload): string {
  switch (payload.type) {
    case 'EXTRACT_EVIDENCE_TEXT':
    case 'MALWARE_SCAN':
      return `${payload.type}:${payload.companyId}:${payload.evidenceVersionId}`;
    case 'RUN_AI_ANALYSIS':
      return `${payload.type}:${payload.companyId}:${payload.evidenceVersionId}:${payload.requestedByUserId}`;
    case 'GENERATE_REPORT':
      return `${payload.type}:${payload.companyId}:${payload.reportId}`;
    case 'EXPIRE_EVIDENCE':
    case 'SEND_TASK_REMINDER':
    case 'SEND_EXPIRY_ALERT':
    case 'CLEANUP_TEMP_UPLOADS':
    case 'RECONCILE_STORAGE_OBJECT':
    case 'PURGE_APPROVED_DELETION_REQUESTS':
    case 'DELIVER_NOTIFICATIONS':
      return `${payload.type}:${payload.companyId ?? 'all'}:${payload.asOf?.slice(0, 10) ?? 'current'}:${'thresholdDays' in payload ? payload.thresholdDays ?? 'default' : 'na'}:${'limit' in payload ? payload.limit ?? 'default' : 'na'}`;
  }
}
