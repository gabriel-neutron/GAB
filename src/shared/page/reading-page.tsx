import type { ReactNode } from 'react';

export interface ReadingPageProps {
  readonly children: ReactNode;
}

/** The ground of a public page: one column that scrolls on the reading scale. A work surface
 * (the map, the graph, the review) takes the full frame and does not use it. */
export function ReadingPage({ children }: ReadingPageProps) {
  // External constraint: the frame holds a fixed height, so the page scrolls inside it and the
  // header stays on the screen.
  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pt-4 pb-8 text-body">
        {children}
      </div>
    </div>
  );
}
