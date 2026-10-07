import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TASK_ALLOWED_TRANSITIONS,
  TASK_STATUS_VALUES,
  buildTaskWorkflowSemantics,
  isTaskOverdueValue,
} from '../src/modules/tasks/task-status-semantics.js';
import { assertTaskTransitionAllowed, isTaskOverdue } from '../src/modules/tasks/task-policy.js';
import { REPORT_LANGUAGE_BOUNDARY_V1, REPORT_SCHEMA_VERSION_V1 } from '../src/modules/reports/schemas/index.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..');
function source(path: string) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

describe('Pass 49 tasks, comments, dashboard, and reports runtime gate', () => {
  it('keeps the v2.1 task lifecycle on COMPLETED semantics and not APPROVED wording', () => {
    expect(TASK_STATUS_VALUES).toEqual(['TODO', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'REJECTED', 'CANCELLED']);
    expect(TASK_STATUS_VALUES).not.toContain('APPROVED');
    expect([...TASK_ALLOWED_TRANSITIONS.SUBMITTED]).toEqual(['COMPLETED', 'REJECTED']);
    expect([...TASK_ALLOWED_TRANSITIONS.COMPLETED]).toEqual([]);
    expect(() => assertTaskTransitionAllowed({ current: 'SUBMITTED', next: 'COMPLETED' })).not.toThrow();
    expect(() => assertTaskTransitionAllowed({ current: 'TODO', next: 'COMPLETED' })).toThrow('Task cannot transition from TODO to COMPLETED');
  });

  it('derives overdue separately from workflow status and excludes only COMPLETED/CANCELLED', () => {
    const now = new Date('2026-08-09T12:00:00.000Z');
    const past = new Date('2026-08-08T12:00:00.000Z');
    expect(isTaskOverdueValue({ status: 'IN_PROGRESS', dueDate: past, now })).toBe(true);
    expect(isTaskOverdue({ status: 'SUBMITTED', dueDate: past, now })).toBe(true);
    expect(isTaskOverdue({ status: 'COMPLETED', dueDate: past, now })).toBe(false);
    expect(isTaskOverdue({ status: 'CANCELLED', dueDate: past, now })).toBe(false);
  });

  it('shows task completion, evidence review, and mapping review as separate badges/contracts', () => {
    const workflow = buildTaskWorkflowSemantics({
      status: 'COMPLETED',
      dueDate: new Date('2026-08-08T12:00:00.000Z'),
      administrativeOnly: false,
      now: new Date('2026-08-09T12:00:00.000Z'),
      taskEvidence: [{ evidence_version: { status: 'NEEDS_REVIEW' } }],
    });
    expect(workflow.taskCompletion.status).toBe('COMPLETED');
    expect(workflow.taskCompletion.overdue).toBe(false);
    expect(workflow.evidenceReview.status).toBe('WAITING_FOR_REVIEW');
    expect(workflow.mappingReview.status).toBe('REVIEW_ON_EVIDENCE_DETAIL');
    expect(workflow.boundary.taskCompletionApprovesEvidence).toBe(false);
    expect(workflow.boundary.taskCompletionApprovesMappings).toBe(false);
  });

  it('keeps task completion from bypassing evidence or mapping approval in the service', () => {
    const tasksService = source('src/modules/tasks/tasks.service.ts');
    expect(tasksService).toContain("action: 'TASK_COMPLETED'");
    expect(tasksService).toContain('TASK_EVIDENCE_REQUIRED');
    expect(tasksService).toContain('administrative_only');
    expect(tasksService).toContain('evidenceApprovalBypassed: false');
    expect(tasksService).toContain('mappingApprovalBypassed: false');
    expect(tasksService).toContain("status: 'COMPLETED'");
    expect(tasksService).not.toContain("status: 'APPROVED'");
  });

  it('authorizes comments through tenant-scoped targets and auditor-visible filtering', () => {
    const commentsService = source('src/modules/comments/comments.service.ts');
    const commentsRepository = source('src/modules/comments/comments.repository.ts');
    expect(commentsService).toContain("requirePermission(params.tenant, 'comments.read')");
    expect(commentsService).toContain("requirePermission(params.tenant, 'comments.create')");
    expect(commentsService).toContain("requirePermission(params.tenant, 'comments.update')");
    expect(commentsService).toContain("requirePermission(params.tenant, 'comments.delete')");
    expect(commentsService).toContain('assertTaskReadPredicate');
    expect(commentsService).toContain("auditorVisibleOnly: params.tenant.role === 'AUDITOR'");
    expect(commentsRepository).toContain('findTargetAuthorizationInTenantScope');
    expect(commentsRepository).toContain("visibility: 'AUDITOR_VISIBLE'");
    expect(commentsRepository).toContain('company_id: params.tenant.companyId');
  });

  it('keeps dashboard metrics on canonical readiness, open tasks, needs review, and expiring evidence', () => {
    const dashboardService = source('src/modules/dashboard/dashboard.service.ts');
    const dashboardRepository = source('src/modules/dashboard/dashboard.repository.ts');
    expect(dashboardService).toContain('calculateCurrentReadiness');
    expect(dashboardService).toContain('readinessStatus: readiness.readinessStatus');
    expect(dashboardService).toContain('readinessPercent: readiness.readinessPercent');
    expect(dashboardService).toContain('needsReview: evidenceNeedingReview + mappingsNeedingReview');
    expect(dashboardService).toContain('overdueTasks');
    expect(dashboardService).toContain('expiringWithinDaysCount');
    expect(dashboardRepository).toContain("status: { notIn: ['COMPLETED', 'CANCELLED'] }");
  });

  it('versions report schemas and blocks certification language in generated report parameters', () => {
    expect(REPORT_SCHEMA_VERSION_V1).toBe('v1');
    expect(REPORT_LANGUAGE_BOUNDARY_V1).toContain('readiness');
    expect(REPORT_LANGUAGE_BOUNDARY_V1).toContain('evidence coverage');
    expect(REPORT_LANGUAGE_BOUNDARY_V1).toContain('not certification');
    expect(REPORT_LANGUAGE_BOUNDARY_V1).toContain('legal compliance');
    const reportsService = source('src/modules/reports/reports.service.ts');
    expect(reportsService).toContain('schema_version: SCHEMA_VERSION');
    expect(reportsService).toContain('languageBoundary: REPORT_LANGUAGE_BOUNDARY_V1');
    expect(reportsService).toContain("languageBoundaryNote: 'not certification or legal compliance'");
    expect(reportsService).toContain("status: { notIn: ['COMPLETED', 'CANCELLED'] }");
    expect(reportsService).toContain("action: 'REPORT_GENERATED'");
    expect(reportsService).toContain("action: 'REPORT_DOWNLOADED'");
  });
});
