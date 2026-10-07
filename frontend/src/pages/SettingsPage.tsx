import { useState, type FormEvent } from 'react';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '../components/ui/AsyncStates';
import { Field, FormActions } from '../components/ui/Forms';
import { StatusBadge } from '../components/ui/StatusBadge';
import { getCurrentCompany, listMembers, updateCompany } from '../features/companies/company-api';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { enableFramework, listFrameworks } from '../features/frameworks/frameworks-api';
import { useApiResource } from '../lib/use-api-resource';
import { NotificationPreferencesPanel } from '../features/notifications/NotificationPreferencesPanel';

function frameworkVersions(framework: { versions?: Array<{ id: string; version: string; status: string }>; framework_versions?: Array<{ id: string; version: string; status: string }> }) {
  return framework.versions ?? framework.framework_versions ?? [];
}

export function SettingsPage() {
  const { activeCompanyId, csrfToken, currentUser, memberships, refreshUser } = useCompanyContext();
  const company = useApiResource(() => getCurrentCompany(activeCompanyId), [activeCompanyId]);
  const members = useApiResource(() => listMembers(activeCompanyId), [activeCompanyId]);
  const frameworks = useApiResource(() => listFrameworks(), []);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleCompanyUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setSuccess(null);
    try {
      await updateCompany(activeCompanyId, csrfToken, {
        name: String(form.get('name') ?? '').trim(),
        industry: String(form.get('industry') ?? '').trim() || null,
        website: String(form.get('website') ?? '').trim() || null,
      });
      setSuccess('Company profile updated.');
      await company.reload();
      await refreshUser();
    } catch (updateError) {
      setError(updateError);
    }
  }

  async function handleEnableFramework(versionId: string, targetAuditDate?: string) {
    setError(null);
    setSuccess(null);
    try {
      await enableFramework(activeCompanyId, csrfToken, versionId, targetAuditDate);
      setSuccess('Framework version enabled. Controls and evidence requirements are now available.');
    } catch (enableError) {
      setError(enableError);
    }
  }

  return (
    <section className="page-stack">
      <p className="eyebrow">Settings</p>
      <h2>Workspace settings</h2>
      <p>Manage company context and framework enrollment while keeping enterprise-only settings out of the MVP workflow.</p>

      <section className="card">
        <h3>Current user and memberships</h3>
        {currentUser ? (
          <>
            <p><strong>{currentUser.user.name}</strong> · {currentUser.user.email}</p>
            <div className="resource-list compact">
              {memberships.map((membership) => (
                <article className="compact-row" key={membership.id}>
                  <div>
                    <strong>{membership.companyName}</strong>
                    <small>{membership.companyId}</small>
                  </div>
                  <StatusBadge label={membership.role} tone="info" />
                </article>
              ))}
            </div>
          </>
        ) : (
          <EmptyState title="Not logged in">Use Login / Register first.</EmptyState>
        )}
      </section>

      <section className="card">
        <h3>Company profile</h3>
        {company.loading ? <LoadingState label="Loading company…" /> : null}
        {company.error ? <ErrorState error={company.error} /> : null}
        {company.data ? (
          <form className="form-grid" onSubmit={(event) => void handleCompanyUpdate(event)}>
            <Field label="Name" htmlFor="company-name">
              <input id="company-name" name="name" defaultValue={company.data.name} required />
            </Field>
            <Field label="Industry" htmlFor="company-industry">
              <input id="company-industry" name="industry" defaultValue={company.data.industry ?? ''} />
            </Field>
            <Field label="Website" htmlFor="company-website">
              <input id="company-website" name="website" type="url" defaultValue={company.data.website ?? ''} />
            </Field>
            <FormActions>
              <button type="submit">Save company</button>
            </FormActions>
          </form>
        ) : null}
      </section>

      <section className="card">
        <h3>Members</h3>
        {members.loading ? <LoadingState label="Loading members…" /> : null}
        {members.error ? <ErrorState error={members.error} /> : null}
        {members.data?.items.length === 0 ? <EmptyState title="No members returned" /> : null}
        {members.data?.items.map((member) => (
          <article className="compact-row" key={member.id}>
            <div>
              <strong>{member.user?.name ?? member.user_id}</strong>
              <small>{member.user?.email ?? member.user_id}</small>
            </div>
            <div className="badge-row">
              <StatusBadge label={member.role} tone="info" />
              <StatusBadge label={member.status} tone={member.status === 'ACTIVE' ? 'success' : 'neutral'} />
            </div>
          </article>
        ))}
      </section>

      <NotificationPreferencesPanel />

      <section className="card">
        <h3>Enable framework version</h3>
        <p className="small-note">Only one active enrollment per company and framework family is allowed by backend constraints.</p>
        {frameworks.loading ? <LoadingState label="Loading frameworks…" /> : null}
        {frameworks.error ? <ErrorState error={frameworks.error} /> : null}
        {frameworks.data?.items.length === 0 ? <EmptyState title="No published frameworks returned" /> : null}
        {frameworks.data?.items.map((framework) => (
          <article className="resource-card" key={framework.id}>
            <div>
              <h4>{framework.name}</h4>
              <p>{framework.description}</p>
              <div className="badge-row">
                {frameworkVersions(framework).map((version) => (
                  <button key={version.id} type="button" onClick={() => void handleEnableFramework(version.id)}>
                    Enable v{version.version}
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>
      {success ? <SuccessNotice>{success}</SuccessNotice> : null}
      {error ? <ErrorState error={error} /> : null}
    </section>
  );
}
