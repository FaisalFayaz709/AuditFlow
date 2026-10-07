import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import { assertTaskTransitionAllowed, isTaskOverdue } from '../src/modules/tasks/task-policy.js';

describe('Pass 10 task policy', () => {
  it('uses COMPLETED instead of APPROVED for task completion', () => {
    expect(() => assertTaskTransitionAllowed({ current: 'SUBMITTED', next: 'COMPLETED' })).not.toThrow();
  });

  it('rejects invalid task transitions', () => {
    expect(() => assertTaskTransitionAllowed({ current: 'TODO', next: 'COMPLETED' })).toThrow(AppError);
  });

  it('treats overdue as derived rather than a workflow state', () => {
    const now = new Date('2026-08-08T10:00:00.000Z');
    const past = new Date('2026-08-07T10:00:00.000Z');
    expect(isTaskOverdue({ status: 'IN_PROGRESS', dueDate: past, now })).toBe(true);
    expect(isTaskOverdue({ status: 'COMPLETED', dueDate: past, now })).toBe(false);
    expect(isTaskOverdue({ status: 'CANCELLED', dueDate: past, now })).toBe(false);
  });
});
