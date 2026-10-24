import { Globe as GlobeIcon, Map as MapIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { cn } from '@/shared/lib/utils';

import { ChainSteps } from './chain-steps';
import { CONTROL } from './control-class';
import { GlobeCanvas } from './globe-canvas';
import { GlobeCard } from './globe-card';
import type { GlobeData } from './globe-data';
import { createGlobeStore } from './globe-store';
import { stageRows } from './legend-rows';
import { ProductFilter } from './product-filter';
import { StageStrip } from './stage-strip';
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
  /** The flat map of every point, or the animated globe of the chain. The address holds it. */
  readonly mode: MapMode;
  readonly onMode: (mode: MapMode) => void;
}

export type MapMode = 'map' | 'globe';

const MODES = [
  { key: 'map', label: 'Map', Icon: MapIcon },
  { key: 'globe', label: 'Globe', Icon: GlobeIcon },
] as const;

// External constraint: the user agent tells the system choice of the reader here, and a media
// query is the one way to read it. The render at the release has no user agent and no motion.
const asksForNoMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The map fills the work area: flat, still and with every point drawn in the map mode, and the
 * animated chain on a globe in the globe mode. Its controls share the site theme. */
export function Globe({ data, entity, entityHref, onSelect, mode, onMode }: GlobeProps) {
  // The address is read once, at the mount, and no render of this component changes it.
  const [seed] = useState(entity);
  // The caller mounts a new globe for each mode, so no state of one mode reaches the other.
  const animated = mode === 'globe';
  const store = useMemo(
    () =>
      createGlobeStore({
        steps: data.steps.map((one) => one.key),
        still: !animated || asksForNoMotion(),
        entity: data.cards[seed] === undefined ? null : seed,
      }),
    [data, seed, animated],
  );
  const rows = useMemo(
    () =>
      stageRows([
        ...data.entities.features.map((one) => one.properties['stageKey']),
        // An exit point is not an entity, and the map draws it as a ring.
        ...data.exits.features.map(() => 'exit'),
      ]),
    [data],
  );
  return (
    <div className="globe-workspace">
      <div className="globe-surface grid min-h-0 flex-1 bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="globe-canvas relative min-h-0 w-full flex-1">
            <GlobeCanvas data={data} store={store} flat={!animated} onSelect={onSelect} />
            <ProductFilter store={store} />
            <div role="group" aria-label="View" className="absolute top-2 right-2 flex">
              {MODES.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  className={cn(CONTROL, '-ml-px first:ml-0')}
                  aria-pressed={mode === key}
                  onClick={() => {
                    if (mode !== key) onMode(key);
                  }}
                >
                  <Icon size={14} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
            <UnavailableNotice store={store} />
          </div>
          {/* One legend for each mode: the steps of the chain are the legend of the globe. */}
          {animated ? (
            <ChainSteps store={store} steps={data.steps} />
          ) : (
            <StageStrip store={store} rows={rows} />
          )}
        </div>
        <GlobeCard store={store} data={data} entityHref={entityHref} />
      </div>
    </div>
  );
}
