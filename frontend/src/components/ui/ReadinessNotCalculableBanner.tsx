export function ReadinessNotCalculableBanner({ reason }: { reason?: string }) {
  return (
    <div className="state-card warning-state" role="status" aria-live="polite">
      <strong>Readiness is not calculable</strong>
      <p>
        No applicable evidence-based controls are eligible for the readiness denominator. This is intentionally shown as
        NOT_CALCULABLE instead of zero or complete readiness.
      </p>
      {reason ? <small>{reason}</small> : null}
    </div>
  );
}
