import type { ReactNode } from 'react';

export function SkipToContentLink() {
  return (
    <a className="skip-link" href="#main-content">
      Skip to main content
    </a>
  );
}

export function PageStateBoundary({
  title,
  children,
  stateDescription,
}: {
  title: string;
  children: ReactNode;
  stateDescription: string;
}) {
  return (
    <section className="page-state-boundary" aria-labelledby={`${slugify(title)}-heading`} aria-describedby={`${slugify(title)}-state`}>
      <h2 id={`${slugify(title)}-heading`}>{title}</h2>
      <p id={`${slugify(title)}-state`} className="small-note">
        {stateDescription}
      </p>
      {children}
    </section>
  );
}

export function ValidationSummary({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="state-card error-state" role="alert" aria-live="assertive">
      <strong>Validation needs attention</strong>
      <ul>
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}

export function RequiredMark() {
  return <span aria-label="required"> *</span>;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
