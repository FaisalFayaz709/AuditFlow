import type { ReactNode } from 'react';

export function ResourceList<T>({
  items,
  emptyTitle,
  renderItem,
}: {
  items: T[];
  emptyTitle: string;
  renderItem: (item: T) => ReactNode;
}) {
  if (items.length === 0) {
    return <div className="state-card empty-state">{emptyTitle}</div>;
  }

  return <div className="resource-list">{items.map(renderItem)}</div>;
}
