import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import {
  BACKUP_LIMITATION_DISCLOSURE,
  MIN_PURGE_WAIT_DAYS,
  PROTECTED_ACCOUNTABILITY_RECORDS,
  RETENTION_POLICY_VERSION,
  assertDeletionApprovalPolicy,
  calculateEarliestExecuteAfter,
  choosePolicyExecuteAfter,
  retentionPolicyDisclosure,
} from '../src/modules/retention/retention-policy.js';

const serviceText = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/modules/retention/retention.service.ts', import.meta.url), 'utf8'));
const jobsText = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/modules/jobs/jobs.service.ts', import.meta.url), 'utf8'));
const routeText = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/modules/retention/retention.routes.ts', import.meta.url), 'utf8'));

describe('Pass 34 retention purge workflow policy', () => {
  it('publishes a policy disclosure with archive-first and backup-expiry limitations', () => {
    const policy = retentionPolicyDisclosure();
    expect(policy.policyVersion).toBe(RETENTION_POLICY_VERSION);
    expect(policy.archiveFirst).toBe(true);
    expect(policy.permanentPurgeRequiresRequest).toBe(true);
    expect(policy.permanentPurgeRequiresApproval).toBe(true);
    expect(policy.minimumPurgeWaitDays).toBe(MIN_PURGE_WAIT_DAYS);
    expect(policy.legalHoldBlocksPurge).toBe(true);
    expect(policy.backupLimitationDisclosure).toContain('backups only as backups expire');
    expect(BACKUP_LIMITATION_DISCLOSURE).toContain('approved deletion workflow');
    expect(PROTECTED_ACCOUNTABILITY_RECORDS).toContain('AUDIT_LOG');
    expect(policy.requesterMayApproveOwnRequest).toBe(false);
  });

  it('enforces minimum purge waiting period even when an earlier executeAfter is requested', () => {
    const now = new Date('2026-08-09T00:00:00.000Z');
    expect(calculateEarliestExecuteAfter(now).toISOString()).toBe('2026-08-16T00:00:00.000Z');
    expect(choosePolicyExecuteAfter(new Date('2026-08-10T00:00:00.000Z'), now).toISOString()).toBe('2026-08-16T00:00:00.000Z');
    expect(choosePolicyExecuteAfter(new Date('2026-09-01T00:00:00.000Z'), now).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('blocks requester self-approval for permanent purge requests', () => {
    expect(() => assertDeletionApprovalPolicy({
      tenant: { companyId: 'co_1', userId: 'user_1', membershipId: 'mem_1', role: 'OWNER' },
      requestedByUserId: 'user_1',
    })).toThrow(AppError);
    expect(() => assertDeletionApprovalPolicy({
      tenant: { companyId: 'co_1', userId: 'user_2', membershipId: 'mem_2', role: 'ADMIN' },
      requestedByUserId: 'user_1',
    })).not.toThrow();
  });

  it('connects the retention service and background job to the policy-controlled purge workflow', () => {
    expect(serviceText).toContain('getRetentionPolicy');
    expect(serviceText).toContain('archiveFirst');
    expect(serviceText).toContain('assertNoActiveLegalHold');
    expect(serviceText).toContain('assertDeletionApprovalPolicy');
    expect(serviceText).toContain('runDueDeletionRequestsForCompany');
    expect(serviceText).toContain('DELETION_COMPLETED');
    expect(serviceText).toContain('retention-purge-worker');
    expect(serviceText).toContain('purgedStorageReference');
    expect(jobsText).toContain('PURGE_APPROVED_DELETION_REQUESTS');
    expect(jobsText).toContain('purgeApprovedDeletionRequests');
    expect(routeText).toContain("/api/retention/policy");
  });
});
