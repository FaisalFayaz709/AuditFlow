import { describe, expect, it } from 'vitest';
import { canCancelTask, canCompleteTask, canRejectTask, canStartTask, canSubmitEvidenceToTask, evidenceReviewBadge, mappingReviewBadge, taskCompletionBadge } from '../features/tasks/task-status-ui';

describe('Pass 33 task status UI semantics', () => {
  it('uses a task completion badge that does not imply evidence or mapping approval', () => {
    const badge = taskCompletionBadge('COMPLETED');
    expect(badge.label).toBe('Task: COMPLETED');
    expect(badge.assistiveText).toContain('evidence and mapping are still separate');
  });

  it('renders evidence and mapping review as separate badge families', () => {
    expect(evidenceReviewBadge('NEEDS_REVIEW').label).toBe('Evidence review: NEEDS_REVIEW');
    expect(mappingReviewBadge('PENDING_REVIEW').label).toBe('Mapping review: PENDING_REVIEW');
    expect(mappingReviewBadge('REVIEW_ON_EVIDENCE_DETAIL').assistiveText).toContain('mapping workflow');
  });

  it('disables task review buttons except in valid task states', () => {
    expect(canStartTask({ status: 'TODO' })).toBe(true);
    expect(canStartTask({ status: 'COMPLETED' })).toBe(false);
    expect(canSubmitEvidenceToTask({ status: 'IN_PROGRESS' })).toBe(true);
    expect(canSubmitEvidenceToTask({ status: 'CANCELLED' })).toBe(false);
    expect(canCompleteTask({ status: 'SUBMITTED', administrative_only: false, task_evidence: [] })).toBe(false);
    expect(canCompleteTask({ status: 'SUBMITTED', administrative_only: true, task_evidence: [] })).toBe(true);
    expect(canRejectTask({ status: 'SUBMITTED' })).toBe(true);
    expect(canCancelTask({ status: 'COMPLETED' })).toBe(false);
  });
});
