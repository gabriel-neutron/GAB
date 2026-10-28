import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

export interface ReadingPageProps {
  readonly children: ReactNode;
  readonly wide?: boolean;
  /** Draws the faint grid on the ground. Only the About page sets it. */
  readonly grid?: boolean;
}

/** The ground of a public page: one column that scrolls on the reading scale. A work surface
 * (the map, the graph, the review) takes the full frame and does not use it. */
export function ReadingPage({ children, wide = false, grid = false }: ReadingPageProps) {
  // External constraint: the frame holds a fixed height, so the page scrolls inside it and the
  // header stays on the screen.
  return (
    <div
      // External constraint: a region that scrolls needs a tab stop, or a keyboard cannot reach
      // a page that holds no link.
      tabIndex={0}
      className={cn(
        'h-full overflow-y-auto overscroll-contain outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50',
        grid && 'grid-ground',
      )}
    >
      <div
        className={cn(
          'mx-auto flex flex-col gap-4 px-4 pt-4 pb-8 text-body-sm',
          wide ? 'w-full' : 'max-w-5xl',
        )}
      >
        {children}
      </div>
    </div>
  );
}
