import { useState } from 'react';
import type { ReactNode } from 'react';

import type { DocId } from '@/shared/fixtures/types';

import { surfaceHref } from './address';
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
 * The parent `__root.tsx` gives `<main>` the rest of the height, so `h-full` settles a pane.
 */
const SHELL = 'flex h-full gap-4 p-4';

const ON_A_SURFACE = 'shrink-0 text-small/4 text-primary underline underline-offset-2';

export function DetailPage({ dossier, arrivedAtSource }: DetailPageProps) {
  // The active source is never written back to the address. Two writers of one identity fight.
  const [activeSource, setActiveSource] = useState<DocId | null>(arrivedAtSource);

  const mark = (sources: readonly SourceRef[]): ReactNode => (
    <SourceMark sources={sources} activeSource={activeSource} onSelectSource={setActiveSource} />
  );

  return (
    <div className={SHELL}>
      {/* The left pane. `min-h-0` is what lets a flex child scroll instead of growing, and
          `overscroll-contain` is what stops the window from taking over at the end of it. */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
        <div className="flex items-baseline gap-2">
          <h1 className="flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate text-base" title={dossier.label}>
              {dossier.label}
            </span>
            <span className="shrink-0 text-xs text-label">{dossier.type}</span>
          </h1>
          {/* The map link is drawn only where the map draws the entity. A link that opens a
              surface which then selects nothing states a position the record does not hold. */}
          <nav aria-label="This entity on a canvas" className="ml-auto flex shrink-0 gap-3">
            <a href={surfaceHref('graph', dossier.entityId)} className={ON_A_SURFACE}>
              Show on the graph
            </a>
            {dossier.drawnOnMap ? (
              <a href={surfaceHref('map', dossier.entityId)} className={ON_A_SURFACE}>
                Show on the map
              </a>
            ) : null}
          </nav>
        </div>

        <EntityRecord rows={dossier.rows} mark={mark} />
        <Relations relations={dossier.relations} mark={mark} />
        <Pending proposals={dossier.pending} mark={mark} />

        {/* M8: the entity itself names the documents it comes from, and no control hides
            them. The mark is the same one the claims carry. */}
        <div className="flex items-center gap-2">
          <span className="text-small/4 tracking-caps text-label uppercase">
            Sources of this entity
          </span>
          {mark(dossier.entitySources)}
        </div>
      </div>

      <div className="w-96 min-h-0 shrink-0">
        {/* The rail follows `activeSource` on its own, and its mount run is the arrival
            case. `arrivedAtSource` reaches it through the state above and by no other path:
            two writers of one scroll position fight each other. */}
        <Rail sources={dossier.sources} activeSource={activeSource} />
      </div>
    </div>
  );
}
