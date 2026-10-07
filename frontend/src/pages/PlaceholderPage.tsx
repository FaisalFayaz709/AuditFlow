import type { ReactNode } from 'react';

type PlaceholderPageProps = {
  title: string;
  description?: ReactNode;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="page-stack">
      <p className="eyebrow">Placeholder</p>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </section>
  );
}
