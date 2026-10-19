import { useId, type ReactNode } from 'react';

export interface PageSectionProps {
  readonly title: string;
  readonly children: ReactNode;
}

/** One titled part of a public page. The title names the section for a screen reader too. */
export function PageSection({ title, children }: PageSectionProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h2 id={titleId} className="text-section font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
