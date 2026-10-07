import type { EvidenceVersionStatus, MappingStatus, Task } from '../../types/api';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export type BadgeDescriptor = {
  label: string;
  tone: BadgeTone;
  icon: string;
  assistiveText: string;
};

const terminalTaskStatuses = new Set(['COMPLETED', 'CANCELLED']);

export function taskCompletionBadge(status: Task['status'] | undefined): BadgeDescriptor {
  switch (status) {
    case 'COMPLETED':
      return { label: 'Task: COMPLETED', tone: 'success', icon: '✓', assistiveText: 'Task submission accepted; evidence and mapping are still separate.' };
    case 'CANCELLED':
      return { label: 'Task: CANCELLED', tone: 'neutral', icon: '–', assistiveText: 'Task cancelled and no longer overdue.' };
    case 'REJECTED':
      return { label: 'Task: REJECTED', tone: 'danger', icon: '!', assistiveText: 'Task submission needs correction.' };
    case 'SUBMITTED':
      return { label: 'Task: SUBMITTED', tone: 'warning', icon: '…', assistiveText: 'Task submission is waiting for task review.' };
    case 'IN_PROGRESS':
      return { label: 'Task: IN_PROGRESS', tone: 'info', icon: '→', assistiveText: 'Assignee is working on the request.' };
    case 'TODO':
      return { label: 'Task: TODO', tone: 'info', icon: '○', assistiveText: 'Task is assigned but not started.' };
    default:
      return { label: 'Task: Unknown', tone: 'neutral', icon: '?', assistiveText: 'Task status was not returned.' };
  }
}

export function evidenceReviewBadge(status: EvidenceVersionStatus | 'NOT_SUBMITTED' | string | undefined): BadgeDescriptor {
  switch (status) {
    case 'APPROVED':
      return { label: 'Evidence review: APPROVED', tone: 'success', icon: '✓', assistiveText: 'Evidence version has been approved by an authorized reviewer.' };
    case 'REJECTED':
    case 'SECURITY_REJECTED':
    case 'EXPIRED':
    case 'SUPERSEDED':
    case 'ARCHIVED':
      return { label: `Evidence review: ${status}`, tone: 'danger', icon: '!', assistiveText: 'Evidence does not currently satisfy readiness requirements.' };
    case 'NEEDS_REVIEW':
    case 'PROCESSING':
    case 'PROCESSING_FAILED':
    case 'UPLOADED':
    case 'QUARANTINED':
      return { label: `Evidence review: ${status}`, tone: 'warning', icon: '…', assistiveText: 'Evidence is not yet approved for readiness.' };
    case 'NOT_SUBMITTED':
      return { label: 'Evidence review: Not submitted', tone: 'neutral', icon: '○', assistiveText: 'No evidence version has been submitted to this task.' };
    default:
      return { label: `Evidence review: ${status ?? 'Unknown'}`, tone: 'neutral', icon: '?', assistiveText: 'Evidence review status must be checked separately.' };
  }
}

export function mappingReviewBadge(status: MappingStatus | 'REVIEW_ON_EVIDENCE_DETAIL' | string | undefined): BadgeDescriptor {
  switch (status) {
    case 'APPROVED':
      return { label: 'Mapping review: APPROVED', tone: 'success', icon: '✓', assistiveText: 'Mapping has been approved by an authorized reviewer.' };
    case 'REJECTED':
      return { label: 'Mapping review: REJECTED', tone: 'danger', icon: '!', assistiveText: 'Mapping was rejected and does not count toward readiness.' };
    case 'SUGGESTED':
    case 'PENDING_REVIEW':
      return { label: `Mapping review: ${status}`, tone: 'warning', icon: '…', assistiveText: 'Mapping is waiting for human review and does not count toward readiness.' };
    case 'REVIEW_ON_EVIDENCE_DETAIL':
      return { label: 'Mapping review: Review separately', tone: 'warning', icon: '↗', assistiveText: 'Open the evidence mapping workflow to approve or reject mappings.' };
    default:
      return { label: `Mapping review: ${status ?? 'Unknown'}`, tone: 'neutral', icon: '?', assistiveText: 'Mapping review status must be checked separately.' };
  }
}

export function overdueBadge(overdue: boolean | undefined): BadgeDescriptor | null {
  if (!overdue) return null;
  return { label: 'Overdue: Yes', tone: 'danger', icon: '!', assistiveText: 'Overdue is derived from due date and non-terminal task status.' };
}

export function canStartTask(task: Pick<Task, 'status'>): boolean {
  return task.status === 'TODO' || task.status === 'REJECTED';
}

export function canSubmitEvidenceToTask(task: Pick<Task, 'status'>): boolean {
  return task.status === 'TODO' || task.status === 'IN_PROGRESS' || task.status === 'REJECTED';
}

export function canCompleteTask(task: Pick<Task, 'status' | 'administrative_only' | 'task_evidence'>): boolean {
  if (task.status !== 'SUBMITTED') return false;
  return task.administrative_only === true || Boolean(task.task_evidence?.length);
}

export function canRejectTask(task: Pick<Task, 'status'>): boolean {
  return task.status === 'SUBMITTED';
}

export function canCancelTask(task: Pick<Task, 'status'>): boolean {
  return !terminalTaskStatuses.has(task.status);
}

export const TASK_UI_BOUNDARY_COPY = 'Task completion does not approve evidence or mappings.';
