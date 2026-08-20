import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { readDossier, readRelation } from '@/features/detail/dossier';
import { RelationSidebar, Sidebar } from '@/features/detail/sidebar';
import { onGraphSelection, type GraphSelection } from '@/features/graph/bridge';
import { GraphPage } from '@/features/graph/graph-page';
import { corpus } from '@/shared/fixtures/corpus';
import { cn } from '@/shared/lib/utils';

/**
 * The graph, and the detail surface beside it — `docs/graph-surface.md` §4.7 and §8 step 4.
 *
 * **This route composes, and it changes neither feature.** ADR 0001 §1 and ADR 0004 §5 make a
 * feature import `shared/` only, so `src/features/graph/` never imports `src/features/detail/`.
 * `src/routes/` is the one folder that puts two features side by side. It holds no domain logic:
 * `features/graph` publishes the selection, and `features/detail` reads the dossier.
 *
 * **The address is read one time, at the mount** — the skill, and §7. A two-way binding between
 * the router and this view is a loop: a write through the router re-renders the route, which
 * destroys the canvas and starts the layout again. `./features/graph/controller.ts` writes the
 * address with `history.replaceState` for that reason, and **that is a report to #33**.
 *
 * **The selection arrives on an event** — §4.6. A property from this route would be a new function
 * on every render, and that defeats the memoisation which keeps the canvas from a re-render.
 *
 * **The aside is always drawn, at one width, so the canvas never changes size** — §4.7. It holds
 * the entity panel of `features/detail`, the relation panel of #89, or one sentence where the
 * read carries no record for what the canvas drew.
 */

/**
 * What the address carries. **Each value is validated at the edge, before its first use.**
 *
 * The two keys are the ones `features/graph/controller.ts` writes. They are flat strings, because
 * the address is a string and this route must never rewrite the shape that the controller reads.
 */
export interface GraphSearch {
  /** The entity that is examined. An empty string is the normal state of the graph. */
  readonly entity: string;
  /**
   * The relation that is examined. **The detail surface draws it since #89**, and
   * `features/graph/controller.ts` is the one writer of this key.
   */
  readonly relation: string;
}

/**
 * The sentence the aside states where the read carries no record for what is selected, **and only
 * where something is selected**.
 *
 * **Nothing selected draws no panel at all** — #82 row D1, Never asked for it. The operator
 * removed the sentence that invited a selection, and the aside with it, so the canvas takes the
 * whole width until something is chosen. The map already worked this way.
 *
 * **The relation is no longer one of these cases** — #89, which replaces the provisional sentence
 * of #82 row D2. A selected relation now reaches `RelationSidebar`. What is left here is one
 * report for each kind: the canvas drew the thing, and the detail read does not carry it.
 *
 * **The words say what the record holds, and never how this application is cut into surfaces**
 * — #82 D2. An analyst is not a reader of the source tree.
 */
const reportOf = (selection: GraphSelection): string => {
  if (selection.kind === 'relation') {
    return 'A relation is selected, and the read holds 0 records for it. The graph draws it, and the detail read does not carry it.';
  }
  return 'An entity is selected, and the read holds 0 records for it. The graph draws it, and the detail read does not carry it.';
};

export const Route = createFileRoute('/graph')({
  // ADR 0004 §7 puts the identity of what is examined in the address. The value comes from
  // outside, so it is validated before its first use, and it falls back instead of throwing: a
  // malformed parameter must never take the graph off the screen.
  validateSearch: (search: Record<string, unknown>): GraphSearch => {
    const entity = search['entity'];
    const relation = search['relation'];
    return {
      entity: typeof entity === 'string' ? entity : '',
      relation: typeof relation === 'string' ? relation : '',
    };
  },

  component: GraphRoute,
  head: () => ({ meta: [{ title: 'Graph · Gabriel' }] }),
});

function GraphRoute() {
  /**
   * **This route reads the address for the selection nowhere, and that is the point.**
   *
   * The defect this deletes: the route seeded this value from the address while
   * `features/graph/controller.ts` read the same address, dropped a selection it cannot draw, and
   * corrected the address. `/graph?entity=E` opened with the type of `E` switched off then drew
   * the whole sidebar of `E`, marked nothing on the canvas, and stripped `E` from the address.
   * **Three surfaces and two answers**, and no reader could tell which was true.
   *
   * The canvas is the authority on what it drew, so it is the only reader of the address here.
   * `validateSearch` above still states the contract of the address, because ADR 0004 §7 puts the
   * identity of what is examined there and the controller reads it. **Do not seed this state from
   * `Route.useSearch()` again.**
   */
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  // **This value sits in an ancestor of the live canvas, and the operator permitted that** — #89,
  // 19 August 2026. It is not the instance, the camera, the style or the selection of the library,
  // and `canvas` below is memoised on an empty list, so no render of this route can reach the
  // element. `src/features/map/map-page.tsx` carries the rule in full.

  /**
   * The one effect of this file, and it is a subscription, which is where the skill permits it.
   * `onGraphSelection` returns the function that stops the listener, so this effect returns it as
   * the cleanup and keeps no name of its own.
   *
   * **It delivers the restore, and not only the changes after it.** `./features/graph/bridge.ts`
   * calls a new listener at once with the selection of that moment, as `features/map/adapter.ts`
   * does. The canvas is a child, so its effect runs before this one and the mount has already
   * announced by the time this line runs.
   */
  useEffect(() => onGraphSelection(setSelection), []);

  /**
   * The dossier of the selected entity, or `null`. The read is memoised on the selection: every
   * other render of this route would otherwise walk the whole corpus again.
   */
  const dossier = useMemo(
    () =>
      selection === null || selection.kind === 'relation'
        ? null
        : readDossier(corpus, selection.id),
    [selection],
  );

  /**
   * The relation the analyst chose, or `null` — #89. **A click on a line has selected a relation
   * on this canvas since #82 row A12, and the aside drew one provisional sentence for it.**
   *
   * The read is memoised on the selection for the reason the dossier above is: every other render
   * of this route would otherwise walk the whole corpus again.
   */
  const relation = useMemo(
    () =>
      selection === null || selection.kind === 'entity' ? null : readRelation(corpus, selection.id),
    [selection],
  );

  /**
   * **`CANVAS.md` and ADR 0004 §3: no React render inside the tree that wraps the live element.**
   * A change of the selection re-renders this route, and without this memo it would build the
   * element that owns the canvas again. The list is empty because the page takes nothing from this
   * route — §4.6 puts the selection on an event for that reason. **Do not remove it.**
   */
  const canvas = useMemo(() => <GraphPage />, []);

  // **The route states the geometry** (§4.7: the route composes). The aside keeps one width for
  // every case, so the canvas never changes size and Sigma is never resized by a selection.
  //
  // **The defect this row exists to not repeat:** the row stated no height, and no ancestor stated
  // one either. A flex row of automatic height grows to the tallest item, so `overflow-y-auto` on
  // the sidebar produced no scroll at all and the **window** scrolled both panes together.
  // **Do not remove the height.**
  //
  // **`h-full` and not a calculation** — #92. `src/routes/__root.tsx` states the height of the
  // header and gives `<main>` everything that is left, so this row asks its parent for that
  // height instead of subtracting a number nobody declared.
  return (
    <div className={cn('flex h-full overflow-hidden')}>
      <div className={cn('min-h-0 min-w-0 flex-1')}>{canvas}</div>
      {/* **No selection draws no panel** — #82 D1. The canvas then takes the whole row, and
          `adapter` and `controller` each observe their own element, so the resize is answered. */}
      {dossier !== null ? (
        <Sidebar dossier={dossier} />
      ) : relation !== null ? (
        /* **The relation reaches a detail view of its own** — #89 and #82 row A12. It is the same
           pane, at the same width, so the canvas never changes size on a selection. */
        <RelationSidebar relation={relation} />
      ) : selection === null ? null : (
        <aside
          aria-label="Detail"
          className={cn('w-96 shrink-0 border-l border-border bg-sidebar p-2 text-xs text-label')}
        >
          <p>{reportOf(selection)}</p>
        </aside>
      )}
    </div>
  );
}
