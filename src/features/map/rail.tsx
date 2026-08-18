/**
 * The layer control and the index, on the left of the map.
 *
 * Built from `docs/map-surface.md` §4.5, §4.7 and §8 step 6, with the findings §3.1 and §3.3 and
 * the rules §5.1, §5.2, §5.4 and §5.5.
 *
 * **The two-step rail itself is `src/shared/rail.tsx` now** — step 5 of `docs/graph-surface.md`
 * §8. The map wrote that control first and the graph wrote it again; two throwaway prototypes may
 * hold one shape twice, and three call sites may not. This file is what stays behind: the state
 * of this surface, the calls of the handle, the index of a type, and everything §4.7 pins below
 * the list.
 *
 * **This is one control, and not two** — §3.1. Four items survive the layer panel: an entry per
 * entity type, a colour, a count and visibility. That is the same control as the type filter, so
 * nothing here draws a presentation setting: no opacity, no reorder, no rename and no colour
 * picker. #36 names a second design of the layer panel as the fault.
 *
 * **It drives the map through the handle, and it touches no library** — §4.2. `adapter.ts` is the
 * only writer of `hiddenTypes`, so a switch here is a call of `setTypeVisible` and never a write
 * of the workspace. `whenStyleReady` inside the adapter absorbs the window while the style loads,
 * so a control of this file can be clicked at any moment.
 *
 * **The state stays here, and it does not move up to `map-page.tsx`.** `CANVAS.md` makes the rail
 * a **sibling** of the canvas, where ordinary React state is permitted, and it asks the author to
 * stop and ask the operator before a value sits in an **ancestor** of the live element. The lift
 * shares the drawing and moves no value upward.
 *
 * **It derives nothing.** `projection.ts` holds `railRows`, `railLegend`, `entitiesMatching` and
 * `linksOfSelection`, and this file turns already-derived arrays into elements.
 *
 * **M9 stays in `row.tsx`.** The blank cell and the header that names the key belong to one line
 * of the index, and this file does not restate them.
 *
 * **The footer is gone, except the ground** — #81 rows B9 to B15, Never asked for it. The
 * relations switch, the row that named a chosen relation, the list of the relations of the
 * selection, and the three counts all left this file.
 *
 * **Three reports left the screen with them, and each loss now has an owner.** A relation that
 * cannot be drawn, an entity that carries no geometry, and the count of what is drawn are stated
 * nowhere. **#35** owns what a surface does with an entity it cannot place. **A click on a line of
 * the map now names nothing at all**, and **#89 DETAIL-RELATION-VIEW** must give a chosen relation
 * somewhere to appear.
 *
 * **The ground switch stays here, and it is the one thing left in the footer.** #81 row A2 moves it
 * onto the map as an icon button. It was not deleted with the rest, because deleting a control
 * before its replacement exists removes the capability. **#94** holds the move, and **#92** rules
 * where a control that floats over a canvas lives.
 */

import { useEffect, useState, type RefObject } from 'react';

import { cn } from '@/shared/lib/utils';
import { Rail as TwoStepRail, type RailAct } from '@/shared/rail';

import type { MapHandle } from './adapter';
import { entitiesOfType, railLegend, railRows, type Projection } from './projection';
import { IndexRows } from './row';

export interface RailProps {
  /** The corpus, reduced to what a map can draw. `./projection` makes it. */
  readonly projection: Projection;
  /**
   * The live map, in the ref that the caller holds. Every act of this rail goes through it, and
   * never through the library.
   *
   * **The instance arrives in a ref, and never in React state above the canvas** — `CANVAS.md`
   * names "the instance in React state above the live element" as the fault the ADR names. The
   * caller renders this rail only after its mount effect fills the ref, so `current` holds the
   * live map for the whole life of this component.
   */
  readonly map: RefObject<MapHandle | null>;
  /** Whether the rail shows the index. The workspace holds it — ADR 0004 §7. */
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Which types are unfolded. It dies with the view, so it is React state — `CANVAS.md` makes the
 * rail a sibling of the canvas.
 *
 * **More than one may stand open** — #82 C5. The rule that closed one group to open the next is
 * gone.
 *
 * **The two cases are not one empty list.** Until the analyst folds a type open, the rail follows
 * the selection of the map: a rail that only listened opened no group on a reload (§5.1). After
 * the first fold the choice of the analyst holds, and an empty list then means "the analyst closed
 * every group", which the selection must not undo.
 */
type OpenTypes =
  | { readonly kind: 'follows-selection' }
  | { readonly kind: 'chosen'; readonly types: readonly string[] };

export function Rail({ projection, map, open, onOpenChange }: RailProps) {
  /**
   * The legend, as the map holds it at this moment. It is seeded from the handle and it is taken
   * from the handle again after each switch, so the adapter stays the one truth and this state is
   * an echo of it that dies with the view.
   *
   * The caller mounts this rail after the map exists, so the ref is full at each read below. The
   * fallback states what a rail with no map draws — everything on — and it invents no setting.
   */
  const [legend, setLegend] = useState(() =>
    railLegend(projection, (type) => map.current?.isTypeVisible(type) ?? true),
  );

  /**
   * **Seed from the current selection, then subscribe** — §5.1. The seed is here, and the
   * subscription below is the same read: `handle.onSelect` calls its listener at once with the
   * selection of that moment, so there is no second path and no window between the two.
   */
  const [selected, setSelected] = useState<string | null>(map.current?.selected ?? null);

  const [openTypes, setOpenTypes] = useState<OpenTypes>({ kind: 'follows-selection' });

  // The one effect of this file, and it is a subscription. It returns the unsubscribe of the
  // handle, so a rail that leaves the screen drives no dead map. The ref is stable, so this list
  // holds for the whole life of the rail. Each subscription seeds itself, so the two states above
  // need no second read.
  useEffect(() => {
    const live = map.current;
    if (live === null) return;
    return live.onSelect(setSelected);
  }, [map]);

  const selectedType = selected === null ? null : (projection.byId.get(selected)?.type ?? null);
  // The selection opens its own group until the analyst folds one, and their choice holds after.
  const shownTypes: readonly string[] =
    openTypes.kind === 'follows-selection'
      ? selectedType === null
        ? []
        : [selectedType]
      : openTypes.types;

  /**
   * **The switch goes through the one writer** — §4.4 and §5.2. This rail writes no workspace
   * field. The adapter stores the types that are switched off, drops a selection that the switch
   * would leave undrawn, and answers `isTypeVisible` after the write.
   */
  const switchType = (type: string, visible: boolean): void => {
    const live = map.current;
    if (live === null) return;
    live.setTypeVisible(type, visible);
    setLegend(railLegend(projection, live.isTypeVisible));
  };

  /** A row selects an entity and moves the camera to it — §4.5. */
  const reach = (id: string): void => {
    const live = map.current;
    if (live === null) return;
    live.select(id);
    live.flyTo(id);
  };

  /**
   * What the analyst did on the shared control. **The act says what happened**, and this answers
   * it in the terms of this surface: a type switch is a call of the handle, and never a write of
   * the workspace.
   */
  const act = (next: RailAct): void => {
    switch (next.kind) {
      case 'open-rail':
        onOpenChange(next.open);
        return;
      case 'switch-type':
        switchType(next.type, next.on);
        return;
      case 'show-every-type':
        // §5.2: the way back from a screen that excludes everything. Each type goes on through the
        // one writer, so the adapter stays the only holder of `hiddenTypes`.
        for (const { facet } of legend.facets) switchType(facet.type, true);
        return;
      case 'open-type':
        // #82 C5: this adds and removes one name, and never replaces the list.
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
      // #82 C5: the rail asks for each open list, because more than one may stand open.
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
