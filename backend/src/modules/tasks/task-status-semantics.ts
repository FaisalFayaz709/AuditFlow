export type TaskStatusValue = 'TODO' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';

export type TaskWorkflowBoundary = {
  taskCompletionApprovesEvidence: false;
  taskCompletionApprovesMappings: false;
  evidenceReviewRoute: 'evidence.review';
  mappingReviewRoute: 'mapping.review';
};

export type TaskEvidenceReviewSummary = {
  scope: 'SEPARATE_EVIDENCE_WORKFLOW';
  status: 'NOT_SUBMITTED' | 'WAITING_FOR_REVIEW' | 'HAS_APPROVED_EVIDENCE' | 'HAS_REJECTED_OR_BLOCKED_EVIDENCE' | 'MIXED_EVIDENCE_STATES';
  submittedCount: number;
  approvedCount: number;
  needsReviewCount: number;
  rejectedOrBlockedCount: number;
  message: string;
};

export type TaskMappingReviewSummary = {
  scope: 'SEPARATE_MAPPING_WORKFLOW';
  status: 'REVIEW_ON_EVIDENCE_DETAIL';
  message: string;
};

export type TaskCompletionSummary = {
  status: TaskStatusValue;
  overdue: boolean;
  terminal: boolean;
  administrativeOnly: boolean;
  message: string;
};

export type TaskWorkflowSemantics = {
  taskCompletion: TaskCompletionSummary;
  evidenceReview: TaskEvidenceReviewSummary;
  mappingReview: TaskMappingReviewSummary;
  boundary: TaskWorkflowBoundary;
};

type EvidenceCarrier = {
  evidence_version?: {
    status?: string | null;
  } | null;
};

export const TASK_STATUS_VALUES: readonly TaskStatusValue[] = ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'REJECTED', 'CANCELLED'] as const;
export const TASK_TERMINAL_STATUSES: ReadonlySet<TaskStatusValue> = new Set(['COMPLETED', 'CANCELLED']);

export const TASK_ALLOWED_TRANSITIONS: Record<TaskStatusValue, ReadonlySet<TaskStatusValue>> = {
  TODO: new Set(['IN_PROGRESS', 'SUBMITTED', 'CANCELLED']),
  IN_PROGRESS: new Set(['SUBMITTED', 'CANCELLED']),
  SUBMITTED: new Set(['COMPLETED', 'REJECTED']),
  COMPLETED: new Set([]),
  REJECTED: new Set(['IN_PROGRESS', 'SUBMITTED', 'CANCELLED']),
  CANCELLED: new Set([]),
};

export const TASK_WORKFLOW_BOUNDARY: TaskWorkflowBoundary = {
  taskCompletionApprovesEvidence: false,
  taskCompletionApprovesMappings: false,
  evidenceReviewRoute: 'evidence.review',
  mappingReviewRoute: 'mapping.review',
};

export function isTaskOverdueValue(params: { status: TaskStatusValue; dueDate: Date | null | undefined; now: Date }): boolean {
  if (!params.dueDate) return false;
  return params.dueDate.getTime() < params.now.getTime() && !TASK_TERMINAL_STATUSES.has(params.status);
}

export function taskStatusMessage(status: TaskStatusValue): string {
  switch (status) {
    case 'TODO':
      return 'Task is assigned but not started.';
    case 'IN_PROGRESS':
      return 'Assignee is working on the request.';
    case 'SUBMITTED':
      return 'Evidence was submitted and the task submission is waiting for task review.';
    case 'COMPLETED':
      return 'Task submission was accepted as complete; evidence and mapping review remain separate.';
    case 'REJECTED':
      return 'Task submission requires correction or replacement.';
    case 'CANCELLED':
      return 'Task is no longer required; cancellation reason is recorded.';
  }
}

export function summarizeEvidenceReviewForTask(taskEvidence: readonly EvidenceCarrier[] | undefined): TaskEvidenceReviewSummary {
  const submitted = taskEvidence ?? [];
  const statuses = submitted.map((item) => item.evidence_version?.status ?? 'UNKNOWN');
  const approvedCount = statuses.filter((status) => status === 'APPROVED').length;
  const needsReviewCount = statuses.filter((status) => status === 'NEEDS_REVIEW' || status === 'PROCESSING' || status === 'PROCESSING_FAILED' || status === 'UPLOADED').length;
  const rejectedOrBlockedCount = statuses.filter((status) => ['REJECTED', 'EXPIRED', 'SUPERSEDED', 'ARCHIVED', 'QUARANTINED', 'SECURITY_REJECTED'].includes(status)).length;

  if (submitted.length === 0) {
    return {
      scope: 'SEPARATE_EVIDENCE_WORKFLOW',
      status: 'NOT_SUBMITTED',
      submittedCount: 0,
      approvedCount: 0,
      needsReviewCount: 0,
      rejectedOrBlockedCount: 0,
      message: 'No evidence version has been submitted to this task.',
    };
  }

  const status = approvedCount > 0 && rejectedOrBlockedCount + needsReviewCount > 0
    ? 'MIXED_EVIDENCE_STATES'
    : approvedCount > 0
      ? 'HAS_APPROVED_EVIDENCE'
      : rejectedOrBlockedCount > 0
        ? 'HAS_REJECTED_OR_BLOCKED_EVIDENCE'
        : 'WAITING_FOR_REVIEW';

  return {
    scope: 'SEPARATE_EVIDENCE_WORKFLOW',
    status,
    submittedCount: submitted.length,
    approvedCount,
    needsReviewCount,
    rejectedOrBlockedCount,
    message: 'Evidence review is independent from task completion and must be decided by the evidence review workflow.',
  };
}

export function mappingReviewSummaryForTask(): TaskMappingReviewSummary {
  return {
    scope: 'SEPARATE_MAPPING_WORKFLOW',
    status: 'REVIEW_ON_EVIDENCE_DETAIL',
    message: 'Mapping review is independent from task completion and must be decided on the evidence/control mapping workflow.',
  };
}

export function buildTaskWorkflowSemantics(params: {
  status: TaskStatusValue;
  dueDate: Date | null | undefined;
  administrativeOnly: boolean | null | undefined;
  taskEvidence?: readonly EvidenceCarrier[];
  now: Date;
}): TaskWorkflowSemantics {
  const overdue = isTaskOverdueValue({ status: params.status, dueDate: params.dueDate, now: params.now });
  return {
    taskCompletion: {
      status: params.status,
      overdue,
      terminal: TASK_TERMINAL_STATUSES.has(params.status),
      administrativeOnly: params.administrativeOnly === true,
      message: taskStatusMessage(params.status),
    },
    evidenceReview: summarizeEvidenceReviewForTask(params.taskEvidence),
    mappingReview: mappingReviewSummaryForTask(),
    boundary: TASK_WORKFLOW_BOUNDARY,
  };
}
