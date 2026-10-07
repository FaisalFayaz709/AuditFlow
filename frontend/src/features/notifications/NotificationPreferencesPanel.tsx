import { useState } from 'react';
import { ErrorState, LoadingState, SuccessNotice } from '../../components/ui/AsyncStates';
import { useApiResource } from '../../lib/use-api-resource';
import { useCompanyContext } from '../companies/CompanyContext';
import { listNotificationPreferences, updateNotificationPreferences, type NotificationPreference } from './notifications-api';

export function NotificationPreferencesPanel() {
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const preferences = useApiResource(() => listNotificationPreferences(activeCompanyId), [activeCompanyId]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function setCategoryEnabled(category: NotificationPreference['category'], enabled: boolean) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateNotificationPreferences(activeCompanyId, csrfToken, [{ category, channel: 'EMAIL', enabled }]);
      setSuccess('Notification preference saved. Mandatory account/security and invitation email remains enabled.');
      await preferences.reload();
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSaving(false);
    }
  }

  const mandatory = new Set(preferences.data?.mandatoryTypes ?? []);

  return (
    <section className="card" aria-label="Notification preferences">
      <h3>Notification preferences</h3>
      <p className="small-note">You may reduce non-security notifications. Account/security and invitation messages remain mandatory.</p>
      <p className="small-note">Restricted evidence is never attached to email by default.</p>
      {preferences.loading ? <LoadingState label="Loading notification preferences…" /> : null}
      {preferences.error ? <ErrorState error={preferences.error} title="Notification preferences unavailable" /> : null}
      {error ? <ErrorState error={error} title="Could not save notification preference" /> : null}
      {success ? <SuccessNotice>{success}</SuccessNotice> : null}
      <div className="resource-list compact">
        {['WORKFLOW', 'REMINDER', 'REPORT', 'AI', 'AUDITOR_ACCESS'].map((category) => (
          <article className="compact-row" key={category}>
            <div>
              <strong>{category}</strong>
              <small>Non-security email category</small>
            </div>
            <div className="badge-row">
              <button type="button" disabled={saving} onClick={() => void setCategoryEnabled(category as NotificationPreference['category'], true)}>Enable</button>
              <button type="button" disabled={saving} onClick={() => void setCategoryEnabled(category as NotificationPreference['category'], false)}>Reduce</button>
            </div>
          </article>
        ))}
      </div>
      <details>
        <summary>Mandatory types</summary>
        <ul>
          {[...mandatory].map((type) => <li key={type}>{type}</li>)}
        </ul>
      </details>
    </section>
  );
}
