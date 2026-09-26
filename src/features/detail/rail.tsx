import { useEffect, useRef } from 'react';

import type { DocId } from '@/shared/read/model';
import { cn } from '@/shared/lib/utils';

import type { SourceCardModel } from './dossier';
import { SourceCard } from './source-card';

export interface RailProps {
  readonly sources: readonly SourceCardModel[];
  readonly activeSource: DocId | null;
  /** Departure: a click on the active source changes no id, and only a click adds one to this
   * count, so the count alone brings the card of that source back into view. */
  readonly selections: number;
}

export function Rail({ sources, activeSource, selections }: RailProps) {
  const cards = useRef(new Map<DocId, HTMLElement>());

  // Departure: `block: 'nearest'` stops an ancestor from scrolling, so the rail moves and the
  // record does not. The mount run is the arrival case, because `?src=` sets `activeSource`
  // before it. A second scroll from a click handler fights this one.
  useEffect(() => {
    if (activeSource === null) return;
    const card = cards.current.get(activeSource);
    if (card === undefined) return;
    card.scrollIntoView({ block: 'nearest' });
  }, [activeSource, selections]);

  return (
    <aside
      aria-label="Sources"
      className="h-full min-h-0 overflow-y-auto overscroll-contain border-l border-border"
    >
      <ul>
        {sources.map((source) => (
          <li
            key={source.id}
            ref={(node) => {
              // External constraint: React runs the callback with `null` when the card leaves.
              // Without the delete the map keeps a detached element for every card the rail drew.
              if (node === null) {
                cards.current.delete(source.id);
              } else {
                cards.current.set(source.id, node);
              }
            }}
            aria-current={activeSource === source.id ? 'true' : undefined}
            className={cn(
              'border-l-2 border-l-transparent',
              activeSource === source.id && 'border-l-foreground bg-muted',
            )}
          >
            <SourceCard source={source} />
          </li>
        ))}
      </ul>
    </aside>
  );
}
