/**
 * The sources of the page, on the right.
 *
 * Built from `docs/detail-surface.md` §4.4, and from the findings §3.3 and §3.6. §5.2 gives each
 * pane its own scroll, and lets a badge in the record move this pane and nothing else.
 *
 * The order is the order `./dossier` numbered: the entity, then the claims, then the relations,
 * then the pending proposals. This file re-orders nothing and de-duplicates nothing, because a
 * second register of that order is a second answer to "which document is number 7".
 */

import { useEffect, useRef } from 'react';

import type { DocId } from '@/shared/fixtures/types';
import { cn } from '@/shared/lib/utils';

import type { SourceCardModel } from './dossier';
import { SourceCard } from './source-card';

export interface RailProps {
  readonly sources: readonly SourceCardModel[];
  /** The document the record points at. The caller owns it; the rail only follows it. */
  readonly activeSource: DocId | null;
}

export function Rail({ sources, activeSource }: RailProps) {
  const cards = useRef(new Map<DocId, HTMLElement>());

  // **This `useEffect` is a known conflict with the component skill**, which puts a `useEffect`
  // in an adapter or a subscription and asks for a count of zero everywhere else. It is here
  // because §4.4 makes the rail move on its own, and a scroll position is a property of the DOM
  // that no render can state. It is reported under ASK and it is not hidden.
  //
  // `block: 'nearest'` is what stops an ancestor from moving: §5.2 says a badge scrolls the
  // rail **alone**, and the record does not move.
  //
  // The mount run of this effect is the arrival case. `activeSource` is already set when the
  // tab was opened with `?src=`, so **one mechanism serves both the click and the arrival**.
  // Do not add a second scroll from a click handler: two writers of one scroll position fight
  // each other, and the second one wins by accident.
  useEffect(() => {
    if (activeSource === null) return;
    const card = cards.current.get(activeSource);
    if (card === undefined) return;
    card.scrollIntoView({ block: 'nearest' });
  }, [activeSource]);

  return (
    <aside
      aria-label="Sources"
      // `border` and not `input`: this hairline separates two panes, and it is not the edge of a
      // control. The audit of the control edges is in `./mark` and `./field`.
      className="h-full min-h-0 overflow-y-auto overscroll-contain border-l border-border"
    >
      <ul>
        {sources.map((source) => (
          <li
            key={source.id}
            ref={(node) => {
              // The callback runs with `null` when the card leaves. Without the delete the map
              // keeps a detached element for every card the rail ever drew.
              if (node === null) {
                cards.current.delete(source.id);
              } else {
                cards.current.set(source.id, node);
              }
            }}
            aria-current={activeSource === source.id ? 'true' : undefined}
            // Rule 8: the mark is not a hue. It is an edge, and it is held at the same width on
            // every card so that the mark moves and the text does not.
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
