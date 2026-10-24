import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

import { cn } from '@/shared/lib/utils';

import type { GlobeStore } from './globe-store';
import type { StageRow } from './legend-rows';
import { useGlobeState } from './use-globe-state';

export interface StageStripProps {
  readonly store: GlobeStore;
  readonly rows: readonly StageRow[];
}

const STAGE_BUTTON = cn(
  'flex h-full min-w-28 shrink-0 flex-col justify-center gap-1 px-1.5 py-1 text-left text-small/4',
  'transition-colors duration-100 hover:bg-muted aria-pressed:bg-muted',
  'outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
);

/** The legend is the chain: the stages in their order from the well, joined by arrows, each with
 * its colour and a bar of its count. A press puts the points of one stage forward on the map and
 * dims the rest. The grey of no stage stands apart, because it is not a step of the chain. */
export function StageStrip({ store, rows }: StageStripProps) {
  const { stage, available } = useGlobeState(store);
  if (!available) return null;
  const most = Math.max(1, ...rows.map((one) => one.count));
  const chain = rows.filter((one) => one.key !== 'none');
  const apart = rows.filter((one) => one.key === 'none');
  const button = (one: StageRow) => (
    <button
      type="button"
      className={STAGE_BUTTON}
      aria-pressed={stage === one.key}
      onClick={() => {
        store.setStage(stage === one.key ? null : one.key);
      }}
    >
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block size-2.5 shrink-0 rounded-full"
          // External constraint: the hue of a stage is a hex that the canvas shares.
          style={{ backgroundColor: one.colour }}
        />
        <span className="whitespace-nowrap">{one.label}</span>
        <span className="sr-only">: </span>
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-1 flex-1 bg-muted">
          <span
            className="block h-full"
            style={{ width: `${String((one.count / most) * 100)}%`, backgroundColor: one.colour }}
          />
        </span>
        <span className="font-mono text-muted-foreground tabular-nums">{one.count}</span>
      </span>
    </button>
  );
  return (
    <div
      role="group"
      aria-label="Stages of the chain"
      className="flex flex-wrap items-stretch border-t border-border"
    >
      <ol className="flex flex-wrap items-stretch">
        {chain.map((one, index) => (
          <Fragment key={one.key}>
            {index === 0 ? null : (
              <li aria-hidden="true" className="flex items-center text-muted-foreground">
                <ChevronRight size={14} />
              </li>
            )}
            <li>{button(one)}</li>
          </Fragment>
        ))}
      </ol>
      {apart.map((one) => (
        <div key={one.key} className="ml-2 border-l border-border">
          {button(one)}
        </div>
      ))}
    </div>
  );
}
