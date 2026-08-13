/**
 * The full page of one entity: the record on the left, the sources on the right.
 *
 * Built from `docs/detail-surface.md` §5.2 (the two panes), §5.1 (the labelling notice), §5.5
 * (the provenance line), §4.4 (the rail and the badge that moves it) and §8 step 5.
 *
 * **It reads no router.** The route reads the address and passes the dossier and the source the
 * reader arrived at. That keeps this file storyable in principle and testable in fact, and it
 * keeps the identity of what is examined in exactly one store (ADR 0004 §7).
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
 * §5.2: the shell needs a settled height, or neither pane can hold a scroll of its own and the
 * window scrolls both together.
 *
 * **`6rem` is a magic number and it belongs to the layout ticket.** It tracks the `p-4` of
 * `src/routes/__root.tsx` and the mode toggle above `<main>`. It is the value of the accepted
 * prototype, it lives at this one point of one file, and it is reported under ASK. The day the
 * layout ticket gives the shell a real height, this expression is deleted and nothing else
 * changes.
 */
const SHELL = 'flex h-[calc(100svh-6rem)] gap-4';

export function DetailPage({ dossier, arrivedAtSource }: DetailPageProps) {
  // §7 and #33: the source the record points at dies with the view, so React state is where
  // ADR 0004 §7 puts it. The initial value is the arrival.
  //
  // **It is never written back to the address.** A two-way binding between the router and a
  // view is a loop, and ADR 0004 §7 already holds the identity of what is examined: the path
  // carries the entity, and `?src=` carries the arrival and nothing after it.
  const [activeSource, setActiveSource] = useState<DocId | null>(arrivedAtSource);

  // §5.1: the mark of every claim, relation and proposal on this surface. The page is the one
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

        {/* §5.1: the words of #12, drawn as `./dossier` wrote them. **No second disclaimer is
            written anywhere on this surface**: one place holds the words, so #12 changes one
            string and every surface follows. */}
        <p className="text-[11px]/4 text-label">{dossier.labellingNotice}</p>

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

        {/* §5.5: the trail of #15, in the words `./dossier` wrote. #45 keeps the stored
            rendered prompt off the screen, and this line does not draw it. */}
        <p className="text-[11px]/4 text-label">{dossier.provenance}</p>
      </div>

      {/* The right pane. The rail holds its own scroll and its own hairline, so this element
          states the width of §4.5 and nothing else. */}
      <div className="w-96 min-h-0 shrink-0">
        {/* §4.4: the rail follows `activeSource` on its own, and its mount run is the arrival
            case. `arrivedAtSource` reaches it through the state above and by no other path:
            two writers of one scroll position fight each other. */}
        <Rail sources={dossier.sources} activeSource={activeSource} />
      </div>
    </div>
  );
}
