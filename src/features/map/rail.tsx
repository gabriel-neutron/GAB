// `whenStyleReady` inside the adapter absorbs the window while the style loads, so a control of
// this file can be clicked at any moment, and never before the style exists.

import { useEffect, useState, type RefObject } from 'react';

import { cn } from '@/shared/lib/utils';
import { Rail as TwoStepRail, type RailAct } from '@/shared/rail';

import type { MapHandle } from './adapter';
import { entitiesOfType, railLegend, railRows, type Projection } from './projection';
import { IndexRows } from './row';

export interface RailProps {
  readonly projection: Projection;
  // The caller renders this rail after its mount effect fills the ref, so `current` holds the
  // live map for the whole life of this component.
  readonly map: RefObject<MapHandle | null>;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

// The two cases are not one empty list. Until the analyst folds a type open, the rail follows the
// selection: a rail that only listened opened no group on a reload. After the first fold an empty
// list means "the analyst closed every group", which the selection must not undo.
type OpenTypes =
  | { readonly kind: 'follows-selection' }
  | { readonly kind: 'chosen'; readonly types: readonly string[] };

export function Rail({ projection, map, open, onOpenChange }: RailProps) {
  // The legend is an echo of the adapter, which stays the one truth: it is seeded from the handle
  // and taken from the handle again after each switch. The fallback draws everything on.
  const [legend, setLegend] = useState(() =>
    railLegend(projection, (type) => map.current?.isTypeVisible(type) ?? true),
  );

  // `handle.onSelect` calls its listener at once with the selection of that moment, so the seed
  // here and the subscription below are the same read, with no window between the two.
  const [selected, setSelected] = useState<string | null>(map.current?.selected ?? null);

  const [openTypes, setOpenTypes] = useState<OpenTypes>({ kind: 'follows-selection' });

  // The effect returns the unsubscribe of the handle, so a rail that leaves the screen drives no
  // dead map. The subscription seeds itself, so the two states above need no second read.
  useEffect(() => {
    const live = map.current;
    if (live === null) return;
    return live.onSelect(setSelected);
  }, [map]);

  const selectedType = selected === null ? null : (projection.byId.get(selected)?.type ?? null);
  const shownTypes: readonly string[] =
    openTypes.kind === 'follows-selection'
      ? selectedType === null
        ? []
        : [selectedType]
      : openTypes.types;

  // The adapter is the one writer: it stores the types that are switched off, drops a selection
  // that the switch would leave undrawn, and answers `isTypeVisible` after the write.
  const switchType = (type: string, visible: boolean): void => {
    const live = map.current;
    if (live === null) return;
    live.setTypeVisible(type, visible);
    setLegend(railLegend(projection, live.isTypeVisible));
  };

  const reach = (id: string): void => {
    const live = map.current;
    if (live === null) return;
    live.select(id);
    live.flyTo(id);
  };

  const act = (next: RailAct): void => {
    switch (next.kind) {
      case 'open-rail':
        onOpenChange(next.open);
        return;
      case 'switch-type':
        switchType(next.type, next.on);
        return;
      case 'show-every-type':
        // The way back from a screen that excludes everything. Each type goes on through the one
        // writer, so the adapter stays the only holder of `hiddenTypes`.
        for (const { facet } of legend.facets) switchType(facet.type, true);
        return;
      case 'open-type':
        setOpenTypes({
          kind: 'chosen',
          types: next.open
            ? [...shownTypes, next.type]
            : shownTypes.filter((type) => type !== next.type),
        });
        return;
    }
  };

  return (
    <TwoStepRail
      rows={railRows(legend, shownTypes, open)}
      onAct={act}
      // The rail asks for each open list, because more than one may stand open.
      index={(type) => {
        const facet = projection.facetByType.get(type);
        return facet === undefined ? null : (
          <IndexRows
            facet={facet}
            entities={entitiesOfType(projection, facet.type)}
            selectedId={selected}
            onSelect={reach}
          />
        );
      }}
      // One hairline separates two surfaces, and `border` is that token. The width is part of the
      // contract — 240px open, and a 44px strip closed.
      className={cn('shrink-0 border-r border-border bg-background', open ? 'w-60' : 'w-11')}
    />
  );
}
