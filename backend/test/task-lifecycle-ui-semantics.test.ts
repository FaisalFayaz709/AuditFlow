import { describe, expect, it } from 'vitest';
import { buildTaskWorkflowSemantics, TASK_ALLOWED_TRANSITIONS, TASK_STATUS_VALUES, summarizeEvidenceReviewForTask } from '../src/modules/tasks/task-status-semantics.js';

const now = new Date('2026-08-09T00:00:00.000Z');

describe('Pass 33 task lifecycle and UI semantics', () => {
  it('uses COMPLETED as terminal task completion and never defines a task approval state', () => {
    expect(TASK_STATUS_VALUES).toEqual(['TODO', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'REJECTED', 'CANCELLED']);
    expect(TASK_STATUS_VALUES).not.toContain('APPROVED');
    expect([...TASK_ALLOWED_TRANSITIONS.SUBMITTED]).toEqual(['COMPLETED', 'REJECTED']);
  });

  it('keeps overdue derived from due date and non-terminal status', () => {
    const overdue = buildTaskWorkflowSemantics({ status: 'IN_PROGRESS', dueDate: new Date('2026-08-01T00:00:00.000Z'), administrativeOnly: false, now });
    expect(overdue.taskCompletion.overdue).toBe(true);

    const completed = buildTaskWorkflowSemantics({ status: 'COMPLETED', dueDate: new Date('2026-08-01T00:00:00.000Z'), administrativeOnly: false, now });
    expect(completed.taskCompletion.overdue).toBe(false);

    const cancelled = buildTaskWorkflowSemantics({ status: 'CANCELLED', dueDate: new Date('2026-08-01T00:00:00.000Z'), administrativeOnly: false, now });
    expect(cancelled.taskCompletion.overdue).toBe(false);
  });

  it('shows evidence review as separate from task completion', () => {
    const semantic = buildTaskWorkflowSemantics({
      status: 'COMPLETED',
      dueDate: null,
      administrativeOnly: false,
      taskEvidence: [{ evidence_version: { status: 'NEEDS_REVIEW' } }],
      now,
    });

    expect(semantic.taskCompletion.status).toBe('COMPLETED');
    expect(semantic.evidenceReview.scope).toBe('SEPARATE_EVIDENCE_WORKFLOW');
    expect(semantic.evidenceReview.status).toBe('WAITING_FOR_REVIEW');
    expect(semantic.boundary.taskCompletionApprovesEvidence).toBe(false);
  });

  it('shows mapping review as separate from task completion', () => {
    const semantic = buildTaskWorkflowSemantics({ status: 'COMPLETED', dueDate: null, administrativeOnly: true, now });
    expect(semantic.mappingReview.scope).toBe('SEPARATE_MAPPING_WORKFLOW');
    expect(semantic.mappingReview.status).toBe('REVIEW_ON_EVIDENCE_DETAIL');
    expect(semantic.boundary.taskCompletionApprovesMappings).toBe(false);
  });

  it('summarizes no submitted evidence distinctly from rejected or approved evidence', () => {
    expect(summarizeEvidenceReviewForTask([]).status).toBe('NOT_SUBMITTED');
    expect(summarizeEvidenceReviewForTask([{ evidence_version: { status: 'REJECTED' } }]).status).toBe('HAS_REJECTED_OR_BLOCKED_EVIDENCE');
    expect(summarizeEvidenceReviewForTask([{ evidence_version: { status: 'APPROVED' } }]).status).toBe('HAS_APPROVED_EVIDENCE');
  });
});
