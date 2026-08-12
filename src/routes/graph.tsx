import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { readDossier } from '@/features/detail/dossier';
import { Sidebar } from '@/features/detail/sidebar';
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
 * the sidebar of `features/detail`, or one sentence for a case that surface cannot take.
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
  /** The relation that is examined. UC3 reaches one, and the detail surface cannot draw it. */
  readonly relation: string;
}

/**
 * The sentence the aside states where it draws no dossier. §4.7 gives two cases the detail
 * surface cannot take, and **both are reports**: a relation, because that surface draws one
 * entity; and an entity that the read does not carry. Each one says the count and the reason.
 */
const reportOf = (selection: GraphSelection | null): string => {
  if (selection === null) return 'Nothing is selected. Select a node or a relation on the graph.';
  if (selection.kind === 'relation') {
    return 'A relation is selected. This surface draws 1 entity, so it draws no relation. Select an entity at one end of it.';
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
  // **`6rem` is a magic number and it belongs to the layout ticket.** It tracks the `p-4` of
  // `src/routes/__root.tsx` and the mode toggle above `<main>`. It is the expression
  // `src/features/detail/detail-page.tsx` uses, it lives at this one point of this file, and it is
  // reported under ASK.
  return (
    <div className={cn('flex h-[calc(100svh-6rem)] overflow-hidden')}>
      <div className={cn('min-h-0 min-w-0 flex-1')}>{canvas}</div>
      {dossier === null ? (
        <aside
          aria-label="Detail"
          className={cn('w-96 shrink-0 border-l border-border bg-sidebar p-2 text-xs text-label')}
        >
          <p>{reportOf(selection)}</p>
        </aside>
      ) : (
        <Sidebar dossier={dossier} />
      )}
    </div>
  );
}
