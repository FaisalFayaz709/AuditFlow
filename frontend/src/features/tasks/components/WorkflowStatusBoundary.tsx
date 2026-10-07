import { StatusBadge } from '../../../components/ui/StatusBadge';
import type { MappingStatus, Task } from '../../../types/api';
import { evidenceReviewBadge, mappingReviewBadge, overdueBadge, taskCompletionBadge, TASK_UI_BOUNDARY_COPY } from '../task-status-ui';

type WorkflowStatusBoundaryProps = {
  task: Pick<Task, 'status' | 'overdue' | 'task_evidence' | 'workflowSemantics'>;
  mappingStatus?: MappingStatus | 'REVIEW_ON_EVIDENCE_DETAIL' | string;
};

function BoundaryBadge({ descriptor }: { descriptor: ReturnType<typeof taskCompletionBadge> }) {
  return (
    <span className="workflow-badge-with-text">
      <StatusBadge label={`${descriptor.icon} ${descriptor.label}`} tone={descriptor.tone} />
      <span className="visually-hidden">{descriptor.assistiveText}</span>
    </span>
  );
}

export function WorkflowStatusBoundary({ task, mappingStatus }: WorkflowStatusBoundaryProps) {
  const submittedEvidenceStatus = task.task_evidence?.[0]?.evidence_version.status;
  const evidenceStatus = task.workflowSemantics?.evidenceReview?.status ?? submittedEvidenceStatus ?? 'NOT_SUBMITTED';
  const effectiveMappingStatus = task.workflowSemantics?.mappingReview?.status ?? mappingStatus ?? 'REVIEW_ON_EVIDENCE_DETAIL';
  const overdue = overdueBadge(task.overdue);

  return (
    <section className="workflow-boundary" aria-label="Task evidence and mapping review boundaries">
      <div className="workflow-boundary__column">
        <h4>Task completion</h4>
        <BoundaryBadge descriptor={taskCompletionBadge(task.status)} />
        {overdue ? <BoundaryBadge descriptor={overdue} /> : null}
      </div>
      <div className="workflow-boundary__column">
        <h4>Evidence review</h4>
        <BoundaryBadge descriptor={evidenceReviewBadge(evidenceStatus)} />
      </div>
      <div className="workflow-boundary__column">
        <h4>Mapping review</h4>
        <BoundaryBadge descriptor={mappingReviewBadge(effectiveMappingStatus)} />
      </div>
      <p className="small-note workflow-boundary__note">{TASK_UI_BOUNDARY_COPY}</p>
    </section>
  );
}
