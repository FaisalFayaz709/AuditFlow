import type { PrismaClient } from '@prisma/client';
import type { AppEnv } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { requirePermission } from '../authz/permissions.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { createPrivateObjectStorage } from '../storage/storage.factory.js';
import { StorageReconciliationService } from '../storage-reconciliation/storage-reconciliation.service.js';
import { RetentionService } from '../retention/retention.service.js';
import { createAuditFlowQueue } from './job-queue.js';
import { jobPayloadDeduplicationKey, type AuditFlowJobPayload, type AuditFlowJobType } from './job-types.js';

export type JobAuditContext = {
  requestId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

// All worker-facing operations use bounded retry behavior through BullMQ queue defaults.
export class JobsService {
  constructor(private readonly prisma: PrismaClient, private readonly env: AppEnv) {}

  async enqueue(params: { tenant: TenantContext; payload: AuditFlowJobPayload; audit: JobAuditContext }) {
    requirePermission(params.tenant, 'jobs.manage');
    if (!this.env.JOBS_ENABLED) {
      throw new AppError({ statusCode: 422, code: 'JOBS_DISABLED', message: 'Background jobs are disabled in this environment.' });
    }

    const deduplicationKey = jobPayloadDeduplicationKey(params.payload);
    const queue = createAuditFlowQueue(this.env);
    try {
      const job = await queue.add(params.payload.type, params.payload, { jobId: deduplicationKey });
      await new AuditLogService(this.prisma).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'JOB_ENQUEUED',
        entityType: 'background_job',
        entityId: String(job.id),
        metadata: { type: params.payload.type, deduplicationKey },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });
      return { id: String(job.id), type: params.payload.type, deduplicationKey };
    } finally {
      await queue.close();
    }
  }

  async getQueueStatus(tenant: TenantContext) {
    requirePermission(tenant, 'jobs.manage');
    if (!this.env.JOBS_ENABLED) return { enabled: false, queueName: 'auditflow-background-jobs' };
    const queue = createAuditFlowQueue(this.env);
    try {
      const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
      return { enabled: true, queueName: queue.name, counts };
    } finally {
      await queue.close();
    }
  }

  async runMaintenanceNow(params: { tenant: TenantContext; type: Extract<AuditFlowJobType, 'EXPIRE_EVIDENCE' | 'SEND_EXPIRY_ALERT' | 'SEND_TASK_REMINDER' | 'CLEANUP_TEMP_UPLOADS' | 'RECONCILE_STORAGE_OBJECT' | 'PURGE_APPROVED_DELETION_REQUESTS' | 'DELIVER_NOTIFICATIONS'>; audit: JobAuditContext }) {
    requirePermission(params.tenant, 'jobs.manage');
    const payload = this.maintenancePayloadForTenant(params.tenant.companyId, params.type);
    if (this.env.JOBS_ENABLED) return this.enqueue({ tenant: params.tenant, payload, audit: params.audit });
    return { inline: true, result: await this.processPayload(payload) };
  }

  maintenancePayloadForTenant(companyId: string, type: AuditFlowJobType): AuditFlowJobPayload {
    switch (type) {
      case 'EXPIRE_EVIDENCE': return { type, companyId, asOf: new Date().toISOString() };
      case 'SEND_EXPIRY_ALERT': return { type, companyId, thresholdDays: this.env.EXPIRING_EVIDENCE_THRESHOLD_DAYS, asOf: new Date().toISOString() };
      case 'SEND_TASK_REMINDER': return { type, companyId, asOf: new Date().toISOString() };
      case 'CLEANUP_TEMP_UPLOADS': return { type, companyId, asOf: new Date().toISOString() };
      case 'RECONCILE_STORAGE_OBJECT': return { type, companyId };
      case 'PURGE_APPROVED_DELETION_REQUESTS': return { type, companyId, asOf: new Date().toISOString() };
      case 'DELIVER_NOTIFICATIONS': return { type, companyId, limit: 100, asOf: new Date().toISOString() };
      default:
        throw new AppError({ statusCode: 422, code: 'JOB_TYPE_NOT_MAINTENANCE', message: 'This job type is not exposed as a maintenance operation.' });
    }
  }

  async processPayload(payload: AuditFlowJobPayload) {
    switch (payload.type) {
      case 'EXPIRE_EVIDENCE': return this.expireEvidence(payload.companyId, payload.asOf);
      case 'SEND_EXPIRY_ALERT': return this.sendExpiryAlerts(payload.companyId, payload.thresholdDays ?? this.env.EXPIRING_EVIDENCE_THRESHOLD_DAYS, payload.asOf);
      case 'SEND_TASK_REMINDER': return this.sendTaskReminders(payload.companyId, payload.asOf);
      case 'CLEANUP_TEMP_UPLOADS': return this.cleanupTemporaryUploads(payload.companyId, payload.asOf);
      case 'RECONCILE_STORAGE_OBJECT': return this.reconcileStorageObjects(payload.companyId, payload.evidenceVersionId);
      case 'PURGE_APPROVED_DELETION_REQUESTS': return this.purgeApprovedDeletionRequests(payload.companyId, payload.asOf);
      case 'DELIVER_NOTIFICATIONS': return this.deliverNotifications(payload.companyId, payload.limit ?? 100);
      case 'MALWARE_SCAN': return this.markMalwareScanPending(payload.companyId, payload.evidenceVersionId);
      case 'EXTRACT_EVIDENCE_TEXT': return this.markExtractionDeferred(payload.companyId, payload.evidenceVersionId);
      case 'RUN_AI_ANALYSIS': return { skipped: true, reason: 'Manual AI route remains source of truth until async AI execution is explicitly enabled.', evidenceVersionId: payload.evidenceVersionId };
      case 'GENERATE_REPORT': return { skipped: true, reason: 'Reports remain synchronous JSON/CSV until report worker execution is enabled.', reportId: payload.reportId };
    }
  }

  private async expireEvidence(companyId?: string, asOf?: string) {
    const now = asOf ? new Date(asOf) : new Date();
    const result = await this.prisma.evidenceVersion.updateMany({
      where: {
        status: 'APPROVED',
        expiry_date: { lt: now },
        ...(companyId ? { evidence_item: { company_id: companyId } } : {}),
      },
      data: { status: 'EXPIRED' },
    });
    return { expiredEvidenceVersions: result.count, calculatedAt: now.toISOString() };
  }

  private async sendExpiryAlerts(companyId: string | undefined, thresholdDays: number, asOf?: string) {
    const now = asOf ? new Date(asOf) : new Date();
    const threshold = addDays(now, thresholdDays);
    const versions = await this.prisma.evidenceVersion.findMany({
      where: {
        status: 'APPROVED',
        expiry_date: { gte: now, lte: threshold },
        evidence_item: { archived_at: null, ...(companyId ? { company_id: companyId } : {}) },
      },
      include: { evidence_item: true },
      take: 500,
    });
    const notifications = new NotificationsService(this.prisma, this.env);
    let createdOrFound = 0;
    for (const version of versions) {
      const owners = await this.prisma.companyMember.findMany({
        where: { company_id: version.evidence_item.company_id, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN', 'COMPLIANCE_MANAGER'] } },
        select: { user_id: true },
      });
      for (const owner of owners) {
        await notifications.createNotification({
          companyId: version.evidence_item.company_id,
          userId: owner.user_id,
          type: 'EVIDENCE_EXPIRING',
          entityType: 'evidence_version',
          entityId: version.id,
          dedupKey: `evidence-expiring:${version.id}:${thresholdDays}:${now.toISOString().slice(0, 10)}`,
          subject: 'Evidence is nearing expiry',
          body: `${version.file_name} expires on ${version.expiry_date?.toISOString().slice(0, 10) ?? 'an upcoming date'}. Review or upload a replacement before readiness is affected.`,
        });
        createdOrFound += 1;
      }
    }
    return { candidateEvidenceVersions: versions.length, notifications: createdOrFound, thresholdDays };
  }

  private async sendTaskReminders(companyId?: string, asOf?: string) {
    const now = asOf ? new Date(asOf) : new Date();
    const dueSoon = addDays(now, this.env.TASK_DUE_SOON_DAYS);
    const tasks = await this.prisma.task.findMany({
      where: {
        ...(companyId ? { company_id: companyId } : {}),
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        due_date: { lte: dueSoon },
        assigned_to_user_id: { not: null },
      },
      take: 500,
    });
    const notifications = new NotificationsService(this.prisma, this.env);
    for (const task of tasks) {
      const overdue = task.due_date ? task.due_date < now : false;
      await notifications.createNotification({
        companyId: task.company_id,
        userId: task.assigned_to_user_id!,
        type: overdue ? 'TASK_OVERDUE' : 'TASK_DUE_SOON',
        entityType: 'task',
        entityId: task.id,
        dedupKey: `task-reminder:${task.id}:${overdue ? 'overdue' : 'due-soon'}:${now.toISOString().slice(0, 10)}`,
        subject: overdue ? 'Task is overdue' : 'Task is due soon',
        body: `${task.title} ${overdue ? 'is overdue' : 'is due soon'}. Complete the task workflow without assuming evidence or mapping approval.`,
      });
    }
    return { reminderCandidates: tasks.length };
  }

  private async cleanupTemporaryUploads(companyId?: string, asOf?: string) {
    return new StorageReconciliationService(this.prisma, createPrivateObjectStorage(this.env)).cleanupExpiredTemporaryUploads({
      companyId,
      asOf: asOf ? new Date(asOf) : new Date(),
    });
  }

  private async reconcileStorageObjects(companyId?: string, evidenceVersionId?: string) {
    return new StorageReconciliationService(this.prisma, createPrivateObjectStorage(this.env)).reconcileEvidenceObjects({
      companyId,
      evidenceVersionId,
    });
  }

  private async purgeApprovedDeletionRequests(companyId?: string, asOf?: string) {
    return new RetentionService(this.prisma).runDueDeletionRequestsForCompany({
      companyId,
      asOf: asOf ? new Date(asOf) : new Date(),
      audit: { requestId: `job:PURGE_APPROVED_DELETION_REQUESTS:${asOf ?? 'current'}` },
    });
  }

  private async deliverNotifications(companyId?: string, limit = 100) {
    // Delivery is intentionally independent from business transactions.
    // The optional companyId scopes the worker pass for tenant sharding while each notification row remains tenant-owned.
    return new NotificationsService(this.prisma, this.env).deliverPending(limit, companyId);
  }

  private async markMalwareScanPending(companyId: string, evidenceVersionId: string) {
    const updated = await this.prisma.evidenceVersion.updateMany({
      where: { id: evidenceVersionId, evidence_item: { company_id: companyId }, security_scan_status: 'PENDING' },
      data: { status: 'QUARANTINED', quarantine_reason: 'Pending asynchronous malware scan.' },
    });
    return { quarantined: updated.count };
  }

  private async markExtractionDeferred(companyId: string, evidenceVersionId: string) {
    const updated = await this.prisma.evidenceVersion.updateMany({
      where: { id: evidenceVersionId, evidence_item: { company_id: companyId }, status: { in: ['UPLOADED', 'PROCESSING'] } },
      data: { status: 'PROCESSING' },
    });
    return { processing: updated.count };
  }
}
