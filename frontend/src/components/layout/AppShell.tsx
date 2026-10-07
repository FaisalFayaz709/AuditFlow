import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { logout } from '../../features/auth/auth-api';
import { CompanyProvider, useCompanyContext } from '../../features/companies/CompanyContext';
import { getVisibleNavItemsForRole } from '../../app/frontend-navigation-policy';
import { NotificationPanel } from '../../features/notifications/NotificationPanel';
import { SkipToContentLink } from '../ui/Accessibility';

type AppShellProps = {
  children: ReactNode;
};

const navGroups = [
  { label: 'Overview', items: ['Dashboard'] },
  { label: 'Compliance work', items: ['Frameworks', 'Framework Upgrade', 'Controls', 'Evidence', 'Tasks', 'Reports'] },
  { label: 'Governance', items: ['Members', 'Auditor Access', 'Auditor View', 'Retention', 'Settings'] },
];

function ShellContent({ children }: AppShellProps) {
  const {
    activeCompanyId,
    activeMembership,
    memberships,
    currentUser,
    csrfToken,
    loadingUser,
    userError,
    setActiveCompanyId,
    refreshUser,
    setCsrfToken,
  } = useCompanyContext();

  const navItems = getVisibleNavItemsForRole(activeMembership?.role);
  const companyName = activeMembership?.companyName ?? (activeCompanyId ? 'Manual workspace' : 'No workspace selected');
  const userName = currentUser?.user.name ?? (loadingUser ? 'Checking session…' : 'Guest');
  const roleLabel = activeMembership?.role ? activeMembership.role.replace(/_/g, ' ') : 'No role';

  async function handleLogout() {
    await logout(csrfToken);
    setCsrfToken(null);
    await refreshUser();
  }

  return (
    <>
      <SkipToContentLink />
      <div className="app-shell">
        <aside className="sidebar" aria-label="Primary navigation">
          <div className="brand-block">
            <div className="brand-mark" aria-hidden="true">AF</div>
            <div>
              <h1>AuditFlow</h1>
              <p className="eyebrow">Compliance Evidence Manager</p>
            </div>
          </div>

          <nav className="primary-nav" aria-label="Main sections">
            {navGroups.map((group) => {
              const groupItems = navItems.filter((item) => group.items.includes(item.label));
              if (groupItems.length === 0) return null;
              return (
                <section className="nav-group" key={group.label} aria-label={group.label}>
                  <p className="nav-group-title">{group.label}</p>
                  {groupItems.map((item) => (
                    <NavLink key={item.to} to={item.to} end={item.to === '/'} aria-label={`${item.label} — ${item.workflow}`}>
                      <span>{item.label}</span>
                      {item.readOnlyForAuditor && activeMembership?.role === 'AUDITOR' ? <small>Read-only</small> : null}
                    </NavLink>
                  ))}
                </section>
              );
            })}
          </nav>

          <div className="sidebar-panel workspace-panel" aria-label="Workspace switcher">
            <div className="panel-kicker">Workspace</div>
            <strong>{companyName}</strong>
            <label className="field compact-field" htmlFor="active-company-id">
              <span>Active company ID</span>
              <input
                id="active-company-id"
                value={activeCompanyId}
                onChange={(event) => setActiveCompanyId(event.target.value.trim())}
                placeholder="Paste company id"
              />
              <small>Sent as x-auditflow-company-id for tenant-scoped requests.</small>
            </label>
            {memberships.length > 0 ? (
              <label className="field compact-field" htmlFor="membership-switcher">
                <span>Switch membership</span>
                <select
                  id="membership-switcher"
                  value={activeCompanyId}
                  onChange={(event) => setActiveCompanyId(event.target.value)}
                >
                  {memberships.map((membership) => (
                    <option key={membership.id} value={membership.companyId}>
                      {membership.companyName} — {membership.role.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </aside>

        <div className="content-shell">
          <header className="topbar" aria-label="Session status">
            <div>
              <p className="eyebrow">Active workspace</p>
              <h2>{companyName}</h2>
            </div>
            <div className="topbar-actions">
              <span className="status-badge status-badge--info">{roleLabel}</span>
              <span className="user-pill" title={currentUser?.user.email}>{userName}</span>
              {currentUser ? (
                <button className="secondary-button" type="button" onClick={() => void handleLogout()}>
                  Logout
                </button>
              ) : loadingUser ? null : (
                <NavLink to="/login" className="button-link">
                  Login / Register
                </NavLink>
              )}
            </div>
            {userError ? <p className="error-text topbar-error">{userError}</p> : null}
          </header>

          <main id="main-content" className="main-content" tabIndex={-1} aria-live="polite">
            {children}
          </main>
        </div>

        {activeCompanyId ? (
          <aside className="insight-rail" aria-label="Notifications and workflow guidance">
            <section className="rail-card">
              <p className="eyebrow">Workflow guardrails</p>
              <h3>Human-reviewed readiness</h3>
              <p>Evidence, mappings, and tasks stay separate so readiness is traceable and auditor-safe.</p>
            </section>
            <NotificationPanel />
          </aside>
        ) : null}
      </div>
    </>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <CompanyProvider>
      <ShellContent>{children}</ShellContent>
    </CompanyProvider>
  );
}
