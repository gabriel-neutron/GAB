// PROTOTYPE — both go with `shared/direction.prototype.ts`.
import { directionOf } from '@/shared/direction.prototype';
import { VariantSwitcher } from '@/shared/variant-switcher.prototype';
import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Sidebar } from '@/features/detail/sidebar';
import { readDossier } from '@/features/detail/dossier';
import { MapPage } from '@/features/map/map-page';
import { corpus } from '@/shared/fixtures/corpus';

/**
 * The map, and the detail sidebar beside it — `docs/detail-surface.md` §8 step 6.
 *
 * **This route composes, and it changes neither feature.** ADR 0001 §1 and ADR 0004 §5 make a
 * feature import `shared/` only, so `src/features/map/` never imports `src/features/detail/`.
 * `src/routes/` is the one folder that puts two features side by side.
 */

/** The address of this route, validated at the edge. */
export interface MapSearch {
  /** The entity the analyst selected. An empty string is the normal state of a map. */
  readonly entity: string;
  /** PROTOTYPE — the direction vocabulary. See `shared/direction.prototype.ts`. */
  readonly variant?: string | undefined;
}

export const Route = createFileRoute('/map')({
  // ADR 0004 §7 puts the identity of what is examined in the address. The value comes from
  // outside, so it is validated before its first use, and it falls back instead of throwing: a
  // malformed parameter must never take the map off the screen.
  validateSearch: (search: Record<string, unknown>): MapSearch => {
    const entity = search['entity'];
    // PROTOTYPE — it goes with `shared/direction.prototype.ts`.
    const variant = search['variant'];
    return {
      entity: typeof entity === 'string' ? entity : '',
      variant: typeof variant === 'string' ? variant : undefined,
    };
  },

  search: { middlewares: [stripSearchParams({ entity: '' })] },
  component: MapRoute,
  head: () => ({ meta: [{ title: 'Map · Gabriel' }] }),
});

function MapRoute() {
  const { entity, variant } = Route.useSearch();
  const navigate = Route.useNavigate();

  // The address of this moment, for `handleSelect` below. The list of that callback must stay
  // `[navigate]` (§3.4), so the value arrives through a ref and never through the list.
  const current = useRef(entity);
  useEffect(() => void (current.current = entity), [entity]);

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
      if ((id ?? '') === current.current) return;
      void navigate({
        search: (previous: MapSearch): MapSearch => ({ ...previous, entity: id ?? '' }),
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

  // **CANVAS.md and ADR 0004 §3: no React re-render inside the tree that wraps the live
  // element.** A selection change re-renders this route, and without the memo it would rebuild
  // the element that owns the canvas. The list holds the one prop the canvas takes, and that
  // prop never changes on a selection (§3.4), so the memo holds across every selection.
  // PROTOTYPE: the variant is in the list, so choosing one mounts the map again — the vocabulary
  // is three layers of the style. The list holds the one real prop again when the prototype goes.
  const canvas = useMemo(
    () => <MapPage onSelect={handleSelect} variant={variant} />,
    [handleSelect, variant],
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
      {/* PROTOTYPE — the bar that cycles the vocabularies of #88. It goes with the prototype. */}
      <VariantSwitcher
        current={directionOf(variant)}
        onChange={(next) => {
          void navigate({ search: (held) => ({ ...held, variant: next }) });
        }}
      />
      <div className="min-h-0 min-w-0 flex-1">{canvas}</div>
      {dossier === null ? null : <Sidebar dossier={dossier} />}
    </div>
  );
}
