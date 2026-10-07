export function EvidencePrivacyNotice() {
  return (
    <div className="state-card warning-state" role="note">
      <strong>Private evidence handling</strong>
      <p>
        The UI never displays storage keys or permanent object URLs. Downloads must go through backend authorization and
        short-lived access only when permitted.
      </p>
    </div>
  );
}
