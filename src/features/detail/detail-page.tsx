/**
 * The full page of one entity: the record on the left, the sources on the right.
 *
 * **It reads no router.** The route reads the address and passes the dossier and the source the
 * reader arrived at. That keeps this file storyable in principle and testable in fact, and it
 * keeps the identity of what is examined in exactly one store.
 *
 * It draws and it derives nothing: `./dossier` decided every list, every word and every order,
 * so this file holds no `.map` at all. Each list belongs to a child.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

import type { DocId } from '@/shared/fixtures/types';

import type { Dossier, SourceRef } from './dossier';
import { SourceMark } from './mark';
import { Pending } from './pending';
import { Rail } from './rail';
import { EntityRecord } from './record';
import { Relations } from './relations';

export interface DetailPageProps {
  readonly dossier: Dossier;
  /** The source named by `?src=`, read once by the route. `null` is the normal arrival. */
  readonly arrivedAtSource: DocId | null;
}

/**
 * The shell needs a settled height, or neither pane can hold a scroll of its own and the window
 * scrolls both together.
 *
 * **It asks its parent, and it calculates nothing.** `src/routes/__root.tsx` states the height of
 * the header once and gives `<main>` the rest, so `h-full` is the whole answer. The
 * `calc(100svh - 6rem)` that stood here tracked a padding and a control height that no file
 * declared.
 *
 * **The padding is here because this page is not a canvas.** The shell carries no margin of its
 * own, so a page that wants one states it. The map and the graph want none: a canvas fills the
 * pane.
 */
const SHELL = 'flex h-full gap-4 p-4';

export function DetailPage({ dossier, arrivedAtSource }: DetailPageProps) {
  // The source the record points at dies with the view, so React state is where it belongs.
  // The initial value is the arrival.
  //
  // **It is never written back to the address.** A two-way binding between the router and a
  // view is a loop, and one store already holds the identity of what is examined: the path
  // carries the entity, and `?src=` carries the arrival and nothing after it.
  const [activeSource, setActiveSource] = useState<DocId | null>(arrivedAtSource);

  // The mark of every claim, relation and proposal on this surface. The page is the one
  // caller that knows which source is active and what a click does.
  const mark = (sources: readonly SourceRef[]): ReactNode => (
    <SourceMark sources={sources} activeSource={activeSource} onSelectSource={setActiveSource} />
  );

  return (
    <div className={SHELL}>
      {/* The left pane. `min-h-0` is what lets a flex child scroll instead of growing, and
          `overscroll-contain` is what stops the window from taking over at the end of it. */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
        <h1 className="flex items-baseline gap-2">
          <span className="text-base">{dossier.label}</span>
          <span className="text-xs text-label">{dossier.type}</span>
        </h1>

        <EntityRecord rows={dossier.rows} mark={mark} />
        <Relations relations={dossier.relations} mark={mark} />
        <Pending proposals={dossier.pending} mark={mark} />

        {/* M8: the entity itself names the documents it comes from, and no control hides
            them. The mark is the same one the claims carry. */}
        <div className="flex items-center gap-2">
          <span className="text-[11px]/4 tracking-[0.06em] text-label uppercase">
            Sources of this entity
          </span>
          {mark(dossier.entitySources)}
        </div>
      </div>

      {/* The right pane. The rail holds its own scroll and its own hairline, so this element
          states the width and nothing else. */}
      <div className="w-96 min-h-0 shrink-0">
        {/* The rail follows `activeSource` on its own, and its mount run is the arrival
            case. `arrivedAtSource` reaches it through the state above and by no other path:
            two writers of one scroll position fight each other. */}
        <Rail sources={dossier.sources} activeSource={activeSource} />
      </div>
    </div>
  );
}
