import { describe, expect, it } from 'vitest';
import { auditFlowJobTypes, jobPayloadDeduplicationKey } from '../src/modules/jobs/job-types';
import { defaultJobOptions } from '../src/modules/jobs/job-queue';

describe('Pass 16 background job policy', () => {
  it('uses the canonical bounded async job set', () => {
    expect(auditFlowJobTypes).toEqual([
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
    ]);
  });

  it('uses bounded retries and retention for queue jobs', () => {
    const options = defaultJobOptions({ JOB_REMOVE_ON_COMPLETE_COUNT: 1000, JOB_REMOVE_ON_FAIL_COUNT: 1000 });
    expect(options.attempts).toBe(5);
    expect(options.backoff).toEqual({ type: 'exponential', delay: 15_000 });
    expect(options.removeOnComplete).toEqual({ count: 1000 });
    expect(options.removeOnFail).toEqual({ count: 1000 });
  });

  it('uses tenant-scoped deterministic job IDs for deduplication', () => {
    expect(jobPayloadDeduplicationKey({ type: 'SEND_EXPIRY_ALERT', companyId: 'co_1', thresholdDays: 30, asOf: '2026-08-08T00:00:00Z' }))
      .toContain('SEND_EXPIRY_ALERT:co_1:2026-08-08:30');
  });
});
