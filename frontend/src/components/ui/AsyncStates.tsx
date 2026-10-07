import type { ReactNode } from 'react';
import { ApiClientError } from '../../lib/api-client';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state-card" role="status" aria-live="polite">
      {label}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state-card empty-state">
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function ErrorState({ error, title = 'Something went wrong' }: { error: unknown; title?: string }) {
  const isUnauthorized = error instanceof ApiClientError && error.status === 401;
  const isForbidden = error instanceof ApiClientError && error.status === 403;
  const isMissingCompany = error instanceof ApiClientError && error.code === 'ACTIVE_COMPANY_REQUIRED';
  const message = error instanceof Error ? error.message : 'Unknown error';

  if (isUnauthorized) {
    return <UnauthorizedState />;
  }

  if (isMissingCompany) {
    return (
      <div className="state-card warning-state" role="alert">
        <strong>Active company required</strong>
        <p>Select or paste the active company ID in the sidebar before loading tenant data.</p>
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="state-card warning-state" role="alert">
        <strong>Not authorized</strong>
        <p>Your active role cannot perform this operation. Backend authorization remains authoritative.</p>
      </div>
    );
  }

  return (
    <div className="state-card error-state" role="alert">
      <strong>{title}</strong>
      <p>{message}</p>
      {error instanceof ApiClientError && error.requestId ? <small>Request ID: {error.requestId}</small> : null}
    </div>
  );
}

export function UnauthorizedState() {
  return (
    <div className="state-card warning-state" role="alert">
      <strong>Authentication required</strong>
      <p>Login or register before using tenant-scoped AuditFlow workflows.</p>
    </div>
  );
}

export function SuccessNotice({ children }: { children: ReactNode }) {
  return (
    <div className="state-card success-state" role="status" aria-live="polite">
      {children}
    </div>
  );
}

type AsyncStateProps = {
  isLoading?: boolean;
  loading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  empty?: boolean;
  title?: string;
  description?: string;
  emptyMessage?: string;
  children?: React.ReactNode;
};

export function AsyncState({
  isLoading,
  loading,
  error,
  isEmpty,
  empty,
  title = 'Something went wrong',
  description,
  emptyMessage = 'No data available yet.',
  children,
}: AsyncStateProps) {
  if (isLoading || loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h3 className="text-sm font-semibold text-red-900">{title}</h3>
        <p className="mt-1 text-sm text-red-700">
          {description ?? (error instanceof Error ? error.message : 'Please try again.')}
        </p>
      </div>
    );
  }

  if (isEmpty || empty) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        {emptyMessage}
      </div>
    );
  }

  return <>{children}</>;
}
