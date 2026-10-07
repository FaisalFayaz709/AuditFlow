import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/AsyncStates';
import { useApiResource } from '../../lib/use-api-resource';
import { useCompanyContext } from '../companies/CompanyContext';
import { listNotifications, markNotificationRead } from './notifications-api';

export function NotificationPanel() {
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const notifications = useApiResource(() => listNotifications(activeCompanyId), [activeCompanyId]);
  const [error, setError] = useState<unknown>(null);

  async function handleRead(id: string) {
    setError(null);
    try {
      await markNotificationRead(activeCompanyId, csrfToken, id);
      await notifications.reload();
    } catch (readError) {
      setError(readError);
    }
  }

  return (
    <section className="sidebar-panel" aria-label="Notifications">
      <h2 className="panel-title">Notifications</h2>
      <p className="small-note">Email notifications contain minimal metadata and link back to authenticated AuditFlow.</p>
      {notifications.loading ? <LoadingState label="Loading notifications…" /> : null}
      {notifications.error ? <ErrorState error={notifications.error} title="Notifications unavailable" /> : null}
      {error ? <ErrorState error={error} title="Could not mark notification read" /> : null}
      {notifications.data && notifications.data.items.length === 0 ? <EmptyState title="No notifications" /> : null}
      <div className="notification-list">
        {notifications.data?.items.map((item) => (
          <article key={item.id} className="notification-item">
            <strong>{item.subject}</strong>
            <p>{item.body}</p>
            <small>{item.type} · {item.preference_category ?? 'WORKFLOW'} · {new Date(item.created_at).toLocaleString()}</small>
            {item.action_url ? <a href={item.action_url}>Open in AuditFlow</a> : null}
            {!item.read_at ? <button type="button" onClick={() => void handleRead(item.id)}>Mark read</button> : <small>Read</small>}
          </article>
        ))}
      </div>
    </section>
  );
}
