import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

/** The pages of the review: the queue of the units, the groups of the queue, the history, the
 * names that joined an author A or B, and the pairs of vessels with one IMO number. The history
 * is reached from here and from no other page. */
export type ReviewView = 'queue' | 'groups' | 'decided' | 'names' | 'imo';

export interface ReviewSurfaceProps {
  readonly view: ReviewView;
  readonly onView: (view: ReviewView) => void;
  readonly queue: ReactNode;
  /** The page of the open view when it is not the queue. It is drawn only while it is open. */
  readonly page: ReactNode;
}

const VIEWS: readonly ReviewView[] = ['queue', 'groups', 'decided', 'names', 'imo'];

const VIEW_WORDS: Readonly<Record<ReviewView, string>> = {
  queue: 'Waiting',
  groups: 'Groups',
  decided: 'Decided',
  names: 'Names',
  imo: 'Same IMO',
};

const TAB = cn(
  'inline-flex h-full items-center border-b-2 border-transparent px-2 text-xs text-label',
  'outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-3',
  'focus-visible:ring-ring/50',
);

export function ReviewSurface({ view, onView, queue, page }: ReviewSurfaceProps) {
  return (
    <div className="flex h-full flex-col">
      <nav
        aria-label="Review pages"
        className="flex h-8 shrink-0 items-stretch border-b border-border"
      >
        {VIEWS.map((held) => (
          <button
            key={held}
            type="button"
            aria-current={held === view ? 'page' : undefined}
            onClick={() => {
              onView(held);
            }}
            className={cn(TAB, held === view ? 'border-primary text-foreground' : null)}
          >
            {VIEW_WORDS[held]}
          </button>
        ))}
      </nav>

      {/* The queue stays mounted under the history. The holds of this pass and the act under the
          hand live in it, and a visit to the history must not end the pass. */}
      <div hidden={view !== 'queue'} className="min-h-0 flex-1">
        {queue}
      </div>
      {view === 'queue' ? null : <div className="min-h-0 flex-1">{page}</div>}
    </div>
  );
}
