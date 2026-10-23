import { useMemo, useState } from 'react';

import { cn } from '@/shared/lib/utils';

import { ChainSteps } from './chain-steps';
import { CONTROL } from './control-class';
import { GlobeCanvas } from './globe-canvas';
import { GlobeCard } from './globe-card';
import type { GlobeData } from './globe-data';
import { createGlobeStore } from './globe-store';
import { MapLegend } from './map-legend';
import { ProductFilter } from './product-filter';
import { UnavailableNotice } from './unavailable-notice';

export interface GlobeProps {
  readonly data: GlobeData;
  /** The entity of the address. The globe reads it once, at the mount. */
  readonly entity: string;
  /** The address of the page of one entity. */
  readonly entityHref: (id: string) => string;
  /** The reader selected an entity, or ended the selection. This function must be the same
   * function at each render of the caller. */
  readonly onSelect: (id: string | null) => void;
}

// External constraint: the user agent tells the system choice of the reader here, and a media
// query is the one way to read it. The render at the release has no user agent and no motion.
const asksForNoMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The map fills the work area: flat, still and with every point drawn, unless the reader turns on
 * the animated globe. Its controls share the site theme. */
export function Globe({ data, entity, entityHref, onSelect }: GlobeProps) {
  // The address is read once, at the mount, and no render of this component changes it.
  const [seed] = useState(entity);
  // The map is flat and still by default. The animated mode is one switch, and it starts a new
  // store, so the globe and the chain begin from their own start.
  const [animated, setAnimated] = useState(false);
  const store = useMemo(
    () =>
      createGlobeStore({
        steps: data.steps.map((one) => one.key),
        still: !animated || asksForNoMotion(),
        entity: data.cards[seed] === undefined ? null : seed,
      }),
    [data, seed, animated],
  );
  return (
    <div className="globe-workspace">
      <div className="globe-surface grid min-h-0 flex-1 bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="globe-canvas relative min-h-0 w-full flex-1">
            <GlobeCanvas data={data} store={store} flat={!animated} onSelect={onSelect} />
            <ProductFilter store={store} />
            <button
              type="button"
              className={cn(CONTROL, 'absolute top-2 right-2')}
              aria-pressed={animated}
              onClick={() => {
                setAnimated(!animated);
              }}
            >
              Animated globe
            </button>
            <UnavailableNotice store={store} />
          </div>
          <MapLegend />
          {animated ? <ChainSteps store={store} steps={data.steps} /> : null}
        </div>
        <GlobeCard store={store} data={data} entityHref={entityHref} />
      </div>
    </div>
  );
}
