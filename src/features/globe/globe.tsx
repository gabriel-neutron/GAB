import { Globe as GlobeIcon, Map as MapIcon } from 'lucide-react';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';
import { useNarrowScreen } from '@/shared/narrow-screen';
import { askPanelFocus } from '@/shared/panel-focus';
import { Rail, type RailAct } from '@/shared/rail';

import { ChainSteps } from './chain-steps';
import { CONTROL } from './control-class';
import { GlobeCanvas } from './globe-canvas';
import { GlobeCard } from './globe-card';
import type { GlobeData } from './globe-data';
import { createGlobeStore, type Target } from './globe-store';
import { stageRows } from './legend-rows';
import { mapRail } from './map-rail';
import { patchMapWorkspace, readMapWorkspace } from './map-workspace';
import { NameList } from './name-list';
import { ProductFilter } from './product-filter';
import { selectedEntity } from './selected-entity';
import { StageStrip } from './stage-strip';
import { UnavailableNotice } from './unavailable-notice';
import { useGlobeState } from './use-globe-state';

export interface GlobeProps {
  readonly data: GlobeData;
  /** The entity of the address. The globe reads it once, at the mount. */
  readonly entity: string;
  /** The card of one target: the route gives the panel of the graph. */
  readonly cardOf: (target: Target) => ReactNode;
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

/** The map mode is the page of the graph on a map: the rail of the types at the left, every
 * point in the middle, and the card of the selection at the right. The globe mode plays the chain
 * on a turning globe. */
export function Globe({ data, entity, cardOf, onSelect, mode, onMode }: GlobeProps) {
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
  const state = useGlobeState(store);
  const legend = useMemo(
    () =>
      stageRows([
        ...data.entities.features.map((one) => one.properties['stageKey']),
        // An exit point is not an entity, and the map draws it as a ring.
        ...data.exits.features.map(() => 'exit'),
      ]),
    [data],
  );

  const [stored, setStored] = useState(readMapWorkspace);
  const [openTypes, setOpenTypes] = useState<readonly string[]>([]);
  // Departure: on a phone the rail is a drawer over the map, as on the graph. It dies with the view.
  const narrow = useNarrowScreen();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const typesButton = useRef<HTMLButtonElement | null>(null);
  if (!narrow && drawerOpen) setDrawerOpen(false);

  const rail = useMemo(
    () =>
      mapRail(data, {
        hiddenTypes: state.hiddenTypes,
        openTypes,
        open: stored.railOpen,
        width: stored.railWidth,
      }),
    [data, state.hiddenTypes, openTypes, stored],
  );

  const act = useCallback(
    (next: RailAct) => {
      switch (next.kind) {
        case 'open-rail':
          if (narrow) setDrawerOpen(next.open);
          else setStored(patchMapWorkspace({ railOpen: next.open }));
          return;
        case 'resize-rail':
          setStored(patchMapWorkspace({ railWidth: next.width }));
          return;
        case 'switch-type': {
          // A point that is off the map is not selected, as on the graph.
          const chosen = selectedEntity(store.get());
          if (!next.on && chosen !== null && data.cards[chosen]?.type === next.type) {
            store.select(null);
          }
          store.setTypeShown(next.type, next.on);
          return;
        }
        case 'show-every-type':
          store.showEveryType();
          return;
        case 'open-type':
          setOpenTypes((held) =>
            next.open ? [...held, next.type] : held.filter((one) => one !== next.type),
          );
          return;
        case 'switch-links':
          return;
      }
    },
    [data, narrow, store],
  );

  const reach = (id: string): void => {
    askPanelFocus();
    store.select({ kind: 'entity', id });
    setDrawerOpen(false);
  };

  const chosen = selectedEntity(state);
  const panelOpen = state.panel.kind !== 'none';

  return (
    <div className="globe-workspace">
      <div
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !drawerOpen) return;
          setDrawerOpen(false);
          typesButton.current?.focus();
        }}
        className={cn(
          'globe-surface grid min-h-0 flex-1 bg-background text-foreground',
          panelOpen
            ? 'md:grid-cols-[auto_minmax(0,1fr)_20rem]'
            : 'md:grid-cols-[auto_minmax(0,1fr)]',
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-col md:col-start-2 md:row-start-1">
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
            {animated ? null : (
              <button
                ref={typesButton}
                type="button"
                aria-expanded={drawerOpen}
                aria-controls="map-rail"
                onClick={() => {
                  setDrawerOpen(true);
                }}
                className={cn(CONTROL, 'absolute bottom-12 left-2 z-10 md:hidden')}
              >
                Types
              </button>
            )}
            <UnavailableNotice store={store} />
          </div>
          {/* One legend for each mode: the steps of the chain are the legend of the globe. */}
          {animated ? (
            <ChainSteps store={store} steps={data.steps} />
          ) : (
            <StageStrip store={store} rows={legend} />
          )}
        </div>

        <GlobeCard store={store} cardOf={cardOf} fallback={narrow ? typesButton : undefined} />

        {/* The rail is last in the order of the keys when the page stacks, and the grid puts it
            first on a wide screen, as on the graph. The globe mode has no rail. */}
        {animated ? null : (
          <div
            id="map-rail"
            className={cn(
              'min-h-0 overflow-hidden border-border md:col-start-1 md:row-start-1 md:border-r',
              'max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-20 max-md:w-72',
              'max-md:max-w-[85%] max-md:border-r max-md:bg-background',
              drawerOpen ? null : 'max-md:hidden',
            )}
          >
            <Rail
              rows={narrow ? { ...rail.rail, open: true } : rail.rail}
              onAct={act}
              index={(type) => {
                const names = rail.lists.get(type);
                return names === undefined ? null : (
                  <NameList names={names} selected={chosen} onSelect={reach} />
                );
              }}
              className="h-full bg-background"
            />
          </div>
        )}
      </div>
    </div>
  );
}
