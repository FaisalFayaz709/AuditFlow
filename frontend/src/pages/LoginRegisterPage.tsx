import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field, FormActions } from '../components/ui/Forms';
import { ErrorState, SuccessNotice } from '../components/ui/AsyncStates';
import { fetchCsrfToken, login, register } from '../features/auth/auth-api';
import { useCompanyContext } from '../features/companies/CompanyContext';

export function LoginRegisterPage() {
  const navigate = useNavigate();
  const { refreshUser, setActiveCompanyId, setCsrfToken } = useCompanyContext();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await login({ email: String(form.get('email')), password: String(form.get('password')) });
      setCsrfToken(result.csrfToken ?? (await fetchCsrfToken()));
      const firstMembership = result.memberships.find((membership) => membership.status === 'ACTIVE') ?? result.memberships[0];
      if (firstMembership) setActiveCompanyId(firstMembership.companyId);
      await refreshUser();
      navigate('/');
    } catch (submitError) {
      setError(submitError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await register({
        name: String(form.get('name')),
        email: String(form.get('email')),
        password: String(form.get('password')),
        companyName: String(form.get('companyName')),
      });
      setCsrfToken(result.csrfToken ?? (await fetchCsrfToken()));
      const firstMembership = result.memberships.find((membership) => membership.status === 'ACTIVE') ?? result.memberships[0];
      if (firstMembership) setActiveCompanyId(firstMembership.companyId);
      setSuccess('Registered. Development email-verification token may be returned by the API in non-production, but verification is separate from login.');
      await refreshUser();
      navigate('/');
    } catch (submitError) {
      setError(submitError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header auth-header">
        <div>
          <p className="eyebrow">Identity</p>
          <h2>Login / Register</h2>
          <p>
            Browser authentication uses the locked opaque HttpOnly session cookie. The frontend never stores a browser JWT.
          </p>
        </div>
      </header>
      <div className="tab-actions" role="tablist" aria-label="Authentication mode">
        <button type="button" className={mode === 'login' ? 'active-tab' : ''} onClick={() => setMode('login')}>
          Login
        </button>
        <button type="button" className={mode === 'register' ? 'active-tab' : ''} onClick={() => setMode('register')}>
          Register
        </button>
      </div>
      {mode === 'login' ? (
        <form className="form-card" onSubmit={(event) => void handleLogin(event)}>
          <Field label="Email" htmlFor="login-email">
            <input id="login-email" name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password" htmlFor="login-password">
            <input id="login-password" name="password" type="password" required autoComplete="current-password" />
          </Field>
          <FormActions>
            <button type="submit" disabled={submitting}>{submitting ? 'Logging in…' : 'Login'}</button>
          </FormActions>
        </form>
      ) : (
        <form className="form-card" onSubmit={(event) => void handleRegister(event)}>
          <Field label="Name" htmlFor="register-name">
            <input id="register-name" name="name" required autoComplete="name" />
          </Field>
          <Field label="Email" htmlFor="register-email">
            <input id="register-email" name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password" htmlFor="register-password" hint="Minimum 12 characters per backend policy.">
            <input id="register-password" name="password" type="password" required minLength={12} autoComplete="new-password" />
          </Field>
          <Field label="Initial company name" htmlFor="register-company">
            <input id="register-company" name="companyName" required />
          </Field>
          <FormActions>
            <button type="submit" disabled={submitting}>{submitting ? 'Registering…' : 'Register'}</button>
          </FormActions>
        </form>
      )}
      {success ? <SuccessNotice>{success}</SuccessNotice> : null}
      {error ? <ErrorState error={error} /> : null}
    </section>
  );
}
