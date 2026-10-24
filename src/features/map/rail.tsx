// `whenStyleReady` inside the adapter absorbs the window while the style loads, so a control of
// this file can be clicked at any moment, and never before the style exists.

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { cn } from '@/shared/lib/utils';
import { Rail as TwoStepRail, type RailAct, type RailRows } from '@/shared/rail';
import { useScreenQuery } from '@/shared/screen-query';

import type { MapHandle } from './adapter';
import { indexLines } from './index-tree';
import { openTypesUnderFilter } from './open-under-filter';
import { railLegend, railRows, type Projection } from './projection';
import { IndexRows } from './row';

export interface RailProps {
  readonly projection: Projection;
  // The caller renders this rail after its mount effect fills the ref, so `current` holds the
  // live map for the whole life of this component.
  readonly map: RefObject<MapHandle | null>;
  /** Whether the rail is open, and how wide. The caller holds both in the workspace. */
  readonly frame: Pick<RailRows, 'open' | 'width'>;
  readonly onFrameChange: (frame: Pick<RailRows, 'open' | 'width'>) => void;
}

export function Rail({ projection, map, frame, onFrameChange }: RailProps) {
  // The legend is an echo of the adapter, which stays the one truth: it is seeded from the handle
  // and taken from the handle again after each switch. The fallback draws everything on.
  const [legend, setLegend] = useState(() =>
    railLegend(
      projection,
      (type) => map.current?.isTypeVisible(type) ?? true,
      map.current?.openUnits ?? new Set(),
    ),
  );

  // `handle.onSelect` calls its listener at once with the selection of that moment, so the seed
  // here and the subscription below are the same read, with no window between the two.
  const [selected, setSelected] = useState<string | null>(map.current?.selected ?? null);

  // The master control of the lines, echoed from the adapter as the legend above is: the adapter
  // is the one holder of the state and the one writer of the store.
  const [linksOn, setLinksOn] = useState(() => map.current?.linksVisible ?? true);

  // A fold is a preference of the view and a selection on the map outranks it: each selection
  // opens the group of its type, and the analyst may fold that group again until the next one.
  const [openTypes, setOpenTypes] = useState<readonly string[]>([]);

  // The listener reads the corpus of the moment through this ref, and never through its closure.
  // A new corpus must not re-run the effect below: the page nulls the handle in the same flush,
  // so the second setup would find no map, and the rail would stay deaf for the rest of its life.
  const corpus = useRef(projection);
  useEffect(() => {
    corpus.current = projection;
  }, [projection]);

  // The effect returns the unsubscribe of the handle, so a rail that leaves the screen drives no
  // dead map. The subscription seeds itself, so no state above needs a second read.
  useEffect(() => {
    const live = map.current;
    if (live === null) return;
    return live.onSelect((id) => {
      setSelected(id);
      // A selection opens each unit above it, so the list reads the folds back from the adapter.
      setLegend(railLegend(corpus.current, live.isTypeVisible, live.openUnits));
      const type = id === null ? null : (corpus.current.byId.get(id)?.type ?? null);
      if (type === null) return;
      setOpenTypes((held) => (held.includes(type) ? held : [...held, type]));
    });
  }, [map]);

  // The adapter is the one writer: it stores the types that are switched off, drops a selection
  // that the switch would leave undrawn, and answers `isTypeVisible` after the write.
  const switchType = (type: string, visible: boolean): void => {
    const live = map.current;
    if (live === null) return;
    live.setTypeVisible(type, visible);
    setLegend(railLegend(projection, live.isTypeVisible, live.openUnits));
  };

  const openUnit = (unit: string, open: boolean): void => {
    const live = map.current;
    if (live === null) return;
    live.setUnitOpen(unit, open);
    setLegend(railLegend(projection, live.isTypeVisible, live.openUnits));
  };

  const reach = (id: string): void => {
    const live = map.current;
    if (live === null) return;
    live.select(id);
    live.flyTo(id);
  };

  // Departure: the adapter drops a selection of a type it does not draw, so the header offers
  // none. An entity folded in the list stays, because a choice of it opens the units above it.
  const drawn = useMemo(
    () => projection.entities.filter((entity) => legend.drawnTypes.has(entity.type)),
    [projection, legend],
  );

  // Departure: the rail reads the filter itself, so a new filter renders this rail and never
  // the canvas. A choice in the header list is a click on the same row of this rail.
  const query = useScreenQuery({ named: drawn, choose: reach });

  const act = (next: RailAct): void => {
    switch (next.kind) {
      case 'open-rail':
        onFrameChange({ ...frame, open: next.open });
        return;
      case 'resize-rail':
        onFrameChange({ ...frame, width: next.width });
        return;
      case 'switch-type':
        switchType(next.type, next.on);
        return;
      case 'switch-links': {
        const live = map.current;
        if (live === null) return;
        live.setLinksVisible(next.on);
        setLinksOn(live.linksVisible);
        return;
      }
      case 'show-every-type':
        // The way back from a screen that excludes everything. Each type goes on through the one
        // writer, so the adapter stays the only holder of `hiddenTypes`.
        for (const { facet } of legend.facets) switchType(facet.type, true);
        return;
      case 'open-type':
        // The updater reads the list of the moment: a selection made on the map may still be
        // queued when this click lands, and a read of the render closure would drop it.
        setOpenTypes((types) =>
          next.open ? [...types, next.type] : types.filter((type) => type !== next.type),
        );
        return;
    }
  };

  return (
    <TwoStepRail
      rows={railRows(
        legend,
        openTypesUnderFilter(legend, projection.entities, openTypes, query),
        frame,
        linksOn,
      )}
      onAct={act}
      // The rail asks for each open list, because more than one may stand open.
      index={(type) => {
        const facet = projection.facetByType.get(type);
        return facet === undefined ? null : (
          <IndexRows
            facet={facet}
            lines={indexLines(projection, legend, facet.type, query, selected)}
            onSelect={reach}
            onOpen={openUnit}
          />
        );
      }}
      // One hairline separates two surfaces, and `border` is that token. The rail states the width.
      className={cn('shrink-0 border-r border-border bg-background')}
    />
  );
}
