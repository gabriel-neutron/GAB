import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RelationSidebar, Sidebar } from '@/features/detail/sidebar';
import { readDossier, readRelation } from '@/features/detail/dossier';
import { MapPage } from '@/features/map/map-page';
import { corpus } from '@/shared/fixtures/corpus';

/**
 * The map, and the detail panel beside it — `docs/detail-surface.md` §8 step 6.
 *
 * **This route composes, and it changes neither feature.** ADR 0001 §1 and ADR 0004 §5 make a
 * feature import `shared/` only, so `src/features/map/` never imports `src/features/detail/`.
 * `src/routes/` is the one folder that puts two features side by side.
 *
 * **The panel draws the relation where one is chosen, and the entity otherwise** — #89. A click
 * on a line chose a relation on this canvas before this ticket, and the removal of the footer of
 * the rail on #81 left that click with nothing to show at all.
 *
 * **The chosen relation wins, and it wins because it is the later act.** `features/map/adapter.ts`
 * keeps the selected entity when a line is clicked, so that the bright lines of that entity stay
 * on the canvas, and it ends the choice on the next click on a point or on the ground. So a
 * chosen relation is always the last thing the analyst asked for, and the panel names it.
 */

/** The address of this route, validated at the edge. */
export interface MapSearch {
  /** The entity the analyst selected. An empty string is the normal state of a map. */
  readonly entity: string;
  /**
   * The relation the analyst chose with a click on a line. An empty string is the normal state.
   *
   * **A relation is identity now** — #89, and ADR 0004 §7. The two keys can carry a value at the
   * same time, because `features/map/adapter.ts` keeps the selected entity when a line is clicked:
   * the bright lines of that entity must stay on the canvas. The address then states exactly what
   * the canvas draws, which is two things.
   */
  readonly relation: string;
}

export const Route = createFileRoute('/map')({
  // ADR 0004 §7 puts the identity of what is examined in the address. The value comes from
  // outside, so it is validated before its first use, and it falls back instead of throwing: a
  // malformed parameter must never take the map off the screen.
  validateSearch: (search: Record<string, unknown>): MapSearch => {
    const entity = search['entity'];
    const relation = search['relation'];
    return {
      entity: typeof entity === 'string' ? entity : '',
      relation: typeof relation === 'string' ? relation : '',
    };
  },

  // An empty key never reaches the address bar. **The adapter reads the address itself**, and an
  // empty value that stayed there would be read as an identifier, which was the defect #89 found
  // on the graph.
  search: { middlewares: [stripSearchParams({ entity: '', relation: '' })] },
  component: MapRoute,
  head: () => ({ meta: [{ title: 'Map · Gabriel' }] }),
});

function MapRoute() {
  const { entity, relation } = Route.useSearch();
  const navigate = Route.useNavigate();

  /**
   * The address of this moment, for the two callbacks below. The list of each one must stay
   * `[navigate]` (§3.4), so the values arrive through a ref and never through the list.
   *
   * **The address is the one carrier of both, and no React state holds a second copy** — #89. The
   * canvas announces, this route writes the address, and this route draws what the address says.
   * Two carriers of one fact drift apart, and the operator asked for that risk to be absent before
   * a relation went into the address at all.
   */
  const current = useRef({ entity, relation });
  useEffect(() => void (current.current = { entity, relation }), [entity, relation]);

  /**
   * The route listens for the selection and writes it to the address —
   * `docs/map-surface.md` §4.8.
   *
   * **The restore is one way, and it occurs one time** — §5.1. The map reads the address at its
   * mount and it is the only writer of the selection after that. So this handler carries the
   * selection out of the map, and nothing here pushes the address back into the map.
   *
   * **`replace: true`** — §5.1. A walk over twenty points would otherwise need twenty presses of
   * the back button to leave the map. A selection is identity, and it is not history.
   *
   * **This function must be the same function at each render.** It is the one prop of the
   * memoised canvas, and §3.4 makes that memo the thing that keeps ADR 0004 §3 and §7 from
   * contradicting each other. `navigate` is itself stable, so this list holds across a change of
   * the selection.
   */
  const handleSelect = useCallback(
    (id: string | null) => {
      // `onSelect` calls a new listener at once with the selection of that moment, so a mount on
      // a plain `/map` would write `?entity=` before the analyst acts. An identifier that equals
      // the address is not an act. A seed that differs still writes: `adapter.ts` drops a
      // restored identifier that it cannot draw, and the address must then lose it.
      if ((id ?? '') === current.current.entity) return;
      void navigate({
        search: (previous: MapSearch): MapSearch => ({ ...previous, entity: id ?? '' }),
        replace: true,
      });
    },
    [navigate],
  );

  /**
   * The same seam for the relation — #89. A click on a line chooses one, and a click on a point or
   * on the ground ends the choice: `features/map/adapter.ts` calls this with `null` for both, so
   * this route holds no second rule for when a relation stops being chosen.
   *
   * **It writes only what the canvas announced.** The subscription delivers the choice of the
   * mount first, so a relation that the address named and the canvas could not draw arrives here
   * as `null` and leaves the address at once. The canvas stays the one authority on what it drew.
   */
  const handleChooseRelation = useCallback(
    (id: string | null) => {
      if ((id ?? '') === current.current.relation) return;
      void navigate({
        search: (previous: MapSearch): MapSearch => ({ ...previous, relation: id ?? '' }),
        replace: true,
      });
    },
    [navigate],
  );

  // An empty address is the normal state of a map, and a stale identifier is as good as none.
  // In both cases the answer is `null`, the route composes no sidebar, and the canvas keeps the
  // full width. There is no "not found" screen here: the map is still the answer.
  //
  // The read is memoised on the identifier: the dossier changes only when the selection does,
  // and every other render of this route would otherwise walk the whole corpus again.
  const dossier = useMemo(() => readDossier(corpus, entity), [entity]);

  // The chosen relation, read the same way and memoised for the same reason. A relation that the
  // read does not carry gives `null`, and the panel then draws the entity, exactly as a stale
  // identifier in the address does above. There is no "not found" screen here either.
  const chosen = useMemo(() => readRelation(corpus, relation), [relation]);

  // **CANVAS.md and ADR 0004 §3: no React re-render inside the tree that wraps the live
  // element.** A selection change re-renders this route, and without the memo it would rebuild
  // the element that owns the canvas. The list holds the one prop the canvas takes, and that
  // prop never changes on a selection (§3.4), so the memo holds across every selection.
  const canvas = useMemo(
    () => <MapPage onSelect={handleSelect} onChooseRelation={handleChooseRelation} />,
    [handleSelect, handleChooseRelation],
  );

  // **The route states the geometry** (§4.5: the route composes). The sidebar states no height
  // and still knows nothing about its neighbour.
  //
  // **The defect this row exists to not repeat:** the row stated no height, and no ancestor
  // stated one either. A flex row of automatic height grows to the tallest item, so
  // `overflow-y-auto` on the sidebar produced no scroll at all and the **window** scrolled both
  // panes together. §5.2 asks each pane to scroll on its own. **Do not remove the height.**
  //
  // **`h-full` and not a calculation** — #92. `src/routes/__root.tsx` states the height of the
  // header and gives `<main>` everything that is left, so this row asks its parent for that
  // height instead of subtracting a number nobody declared.
  return (
    <div className="flex h-full overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1">{canvas}</div>
      {chosen !== null ? (
        <RelationSidebar relation={chosen} />
      ) : dossier === null ? null : (
        <Sidebar dossier={dossier} />
      )}
    </div>
  );
}
