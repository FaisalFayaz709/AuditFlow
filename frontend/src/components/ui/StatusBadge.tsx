export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

type StatusBadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone}`} data-status-label={label}>{label}</span>;
}

export function EvidenceReviewBadge({ status }: { status?: string }) {
  const tone = status === 'APPROVED' ? 'success' : status === 'REJECTED' || status === 'SECURITY_REJECTED' ? 'danger' : status === 'NEEDS_REVIEW' ? 'warning' : 'neutral';
  return <StatusBadge label={`Evidence review: ${status ?? 'Unknown'}`} tone={tone} />;
}

export function MappingReviewBadge({ status }: { status?: string }) {
  const tone = status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'danger' : status === 'SUGGESTED' || status === 'PENDING_REVIEW' ? 'warning' : 'neutral';
  return <StatusBadge label={`Mapping review: ${status ?? 'Unknown'}`} tone={tone} />;
}

export function TaskCompletionBadge({ status }: { status?: string }) {
  const tone = status === 'COMPLETED' ? 'success' : status === 'CANCELLED' ? 'neutral' : status === 'REJECTED' ? 'danger' : status === 'SUBMITTED' ? 'warning' : 'info';
  return <StatusBadge label={`Task: ${status ?? 'Unknown'}`} tone={tone} />;
}
