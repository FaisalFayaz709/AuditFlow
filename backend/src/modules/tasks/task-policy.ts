import { AppError } from '../../shared/errors.js';
import { requirePermission } from '../authz/permissions.js';
import { assertTaskReadPredicate, assertTaskSubmitPredicate } from '../authz/predicates.js';
import type { TenantContext } from '../../shared/tenant-context.js';

import { TASK_ALLOWED_TRANSITIONS, TASK_TERMINAL_STATUSES, isTaskOverdueValue, type TaskStatusValue } from './task-status-semantics.js';

// terminalStatuses are supplied by TASK_TERMINAL_STATUSES and include 'COMPLETED' and 'CANCELLED'.

export function isTaskOverdue(params: { status: TaskStatusValue; dueDate: Date | null | undefined; now: Date }): boolean {
  if (!params.dueDate) return false;
  if (TASK_TERMINAL_STATUSES.has(params.status)) return false;
  return isTaskOverdueValue(params);
}

export function assertTaskTransitionAllowed(params: { current: TaskStatusValue; next: TaskStatusValue }): void {
  if (!TASK_ALLOWED_TRANSITIONS[params.current].has(params.next)) {
    throw new AppError({
      statusCode: 409,
      code: 'INVALID_TASK_STATE_TRANSITION',
      message: `Task cannot transition from ${params.current} to ${params.next}.`,
      details: [{ field: 'status', reason: `current=${params.current}; next=${params.next}` }],
    });
  }
}

export function assertCanReadTask(params: { tenant: TenantContext; assignedToUserId: string | null }): void {
  assertTaskReadPredicate(params);
}

export function assertCanSubmitTask(params: { tenant: TenantContext; assignedToUserId: string | null }): void {
  assertTaskSubmitPredicate(params);
}

export function assertCanManageTasks(tenant: TenantContext): void {
  requirePermission(tenant, 'tasks.manage');
}

export function assertCanReviewTasks(tenant: TenantContext): void {
  requirePermission(tenant, 'tasks.review');
}
