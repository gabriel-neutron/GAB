import type { ReactNode } from 'react';

export interface PageHeaderProps {
  readonly title: string;
  /** One quiet line below the title: a type, a version, an identifier. */
  readonly detail?: ReactNode;
  /** The controls of the page, at the end of the title row. */
  readonly actions?: ReactNode;
}

/** The title of a public page, with its one line of detail and its controls. */
export function PageHeader({ title, detail, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border pb-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-heading-sm font-semibold tracking-tight break-words">{title}</h1>
        {detail === undefined ? null : <div className="text-xs/5 text-label">{detail}</div>}
      </div>
      {actions === undefined ? null : (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
