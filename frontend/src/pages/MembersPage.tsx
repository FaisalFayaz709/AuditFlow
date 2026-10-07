import { useState, type FormEvent } from 'react';
import { EmptyState, ErrorState, LoadingState, SuccessNotice } from '../components/ui/AsyncStates';
import { Field, FormActions } from '../components/ui/Forms';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ValidationSummary } from '../components/ui/Accessibility';
import { useCompanyContext } from '../features/companies/CompanyContext';
import { changeMemberRole, createInvitation, listInvitations, listMembers, removeMember, resendInvitation, revokeInvitation } from '../features/companies/company-api';
import { useApiResource } from '../lib/use-api-resource';

const roles = ['OWNER', 'ADMIN', 'COMPLIANCE_MANAGER', 'MEMBER', 'AUDITOR'];

export function MembersPage() {
  const { activeCompanyId, csrfToken } = useCompanyContext();
  const members = useApiResource(() => listMembers(activeCompanyId), [activeCompanyId]);
  const invitations = useApiResource(() => listInvitations(activeCompanyId), [activeCompanyId]);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  async function refresh() {
    await Promise.all([members.reload(), invitations.reload()]);
  }

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationErrors([]);
    setSuccess(null);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const role = String(form.get('role') ?? 'MEMBER');
    const errors = [];
    if (!email.includes('@')) errors.push('Invitee email must be a valid email address.');
    if (!roles.includes(role)) errors.push('Selected role must be one of the locked AuditFlow roles.');
    if (errors.length) {
      setValidationErrors(errors);
      return;
    }
    try {
      await createInvitation(activeCompanyId, csrfToken, { email, role });
      event.currentTarget.reset();
      setSuccess('Invitation created. Backend stores a hashed single-use token and enforces expiry.');
      await refresh();
    } catch (inviteError) {
      setError(inviteError);
    }
  }

  async function updateRole(memberId: string, role: string) {
    setError(null);
    setSuccess(null);
    try {
      await changeMemberRole(activeCompanyId, csrfToken, memberId, role);
      setSuccess('Member role change requested. Backend owner-transfer/final-owner policies remain authoritative.');
      await members.reload();
    } catch (roleError) {
      setError(roleError);
    }
  }

  async function remove(memberId: string) {
    setError(null);
    setSuccess(null);
    try {
      await removeMember(activeCompanyId, csrfToken, memberId);
      setSuccess('Member removal requested. Historical actor attribution remains preserved by backend policy.');
      await members.reload();
    } catch (removeError) {
      setError(removeError);
    }
  }

  return (
    <section className="page-stack">
      <p className="eyebrow">Members</p>
      <h2>Company members and invitations</h2>
      <p>Manage active membership and pending invitations. Frontend visibility is convenience only; backend authorization remains authoritative.</p>
      <ValidationSummary errors={validationErrors} />
      {success ? <SuccessNotice>{success}</SuccessNotice> : null}
      {error ? <ErrorState error={error} /> : null}

      <form className="form-card" onSubmit={(event) => void submitInvitation(event)}>
        <h3>Invite member</h3>
        <Field label="Email" htmlFor="invite-email">
          <input id="invite-email" name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Role" htmlFor="invite-role" hint="Auditors still require selected grants for evidence/report access.">
          <select id="invite-role" name="role" defaultValue="MEMBER">
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </Field>
        <FormActions><button type="submit">Create invitation</button></FormActions>
      </form>

      <section className="card">
        <h3>Active and historical members</h3>
        {members.loading ? <LoadingState label="Loading members…" /> : null}
        {members.error ? <ErrorState error={members.error} /> : null}
        {members.data?.items.length === 0 ? <EmptyState title="No members returned" /> : null}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{members.data?.items.map((member) => (
              <tr key={member.id}>
                <td><strong>{member.user?.name ?? member.user_id}</strong><br /><small>{member.user?.email ?? member.user_id}</small></td>
                <td>
                  <label className="visually-hidden" htmlFor={`role-${member.id}`}>Role for {member.user?.email ?? member.id}</label>
                  <select id={`role-${member.id}`} value={member.role} onChange={(event) => void updateRole(member.id, event.target.value)}>
                    {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </td>
                <td><StatusBadge label={member.status} tone={member.status === 'ACTIVE' ? 'success' : 'neutral'} /></td>
                <td><button type="button" className="secondary-button" onClick={() => void remove(member.id)}>Remove</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Invitations</h3>
        {invitations.loading ? <LoadingState label="Loading invitations…" /> : null}
        {invitations.error ? <ErrorState error={invitations.error} /> : null}
        {invitations.data?.items.length === 0 ? <EmptyState title="No pending invitations" /> : null}
        {invitations.data?.items.map((invitation) => (
          <article className="compact-row" key={invitation.id}>
            <div><strong>{invitation.email}</strong><small>{invitation.expires_at ? `Expires ${new Date(invitation.expires_at).toLocaleString()}` : 'Expiry not returned'}</small></div>
            <div className="badge-row"><StatusBadge label={invitation.role} tone="info" /><StatusBadge label={invitation.status} tone={invitation.status === 'PENDING' ? 'warning' : 'neutral'} /></div>
            <div className="button-stack"><button type="button" onClick={() => void resendInvitation(activeCompanyId, csrfToken, invitation.id).then(refresh)}>Resend</button><button type="button" className="secondary-button" onClick={() => void revokeInvitation(activeCompanyId, csrfToken, invitation.id).then(refresh)}>Revoke</button></div>
          </article>
        ))}
      </section>
    </section>
  );
}
