import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { readDossier, readRelation } from '@/features/detail/dossier';
import { RelationSidebar, Sidebar } from '@/features/detail/sidebar';
import { onGraphSelection, type GraphSelection } from '@/features/graph/bridge';
import { GraphPage } from '@/features/graph/graph-page';
import { corpus } from '@/shared/fixtures/corpus';
import { cn } from '@/shared/lib/utils';

// The address is the one store of what is examined. Two carriers of one fact drift apart.
// A write through the router re-renders this route and destroys the canvas, so
// `features/graph/controller.ts` writes the address with `history.replaceState`.
export interface GraphSearch {
  /** The entity that is examined. An empty string is the normal state of the graph. */
  readonly entity: string;
  readonly relation: string;
}

/** The words state what the record holds, and never how the application is cut into surfaces. */
const reportOf = (selection: GraphSelection): string => {
  if (selection.kind === 'relation') {
    return 'A relation is selected, and the read holds 0 records for it. The graph draws it, and the detail read does not carry it.';
  }
  return 'An entity is selected, and the read holds 0 records for it. The graph draws it, and the detail read does not carry it.';
};

export const Route = createFileRoute('/graph')({
  // The identity of what is examined lives in the address. The value comes from
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
  // Do not seed this state from `Route.useSearch()`. The canvas is the authority on what it drew,
  // and a second reader of the address gave the route and the canvas two different answers.
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  // This state sits in an ancestor of the live canvas. `canvas` below is memoised on an empty
  // list, so no render of this route rebuilds the element. `onGraphSelection` calls a new
  // listener at once with the selection of the moment, so the effect below delivers the restore.
  useEffect(() => onGraphSelection(setSelection), []);

  // The read is memoised: every other render of this route would walk the whole corpus again.
  const dossier = useMemo(
    () =>
      selection === null || selection.kind === 'relation'
        ? null
        : readDossier(corpus, selection.id),
    [selection],
  );

  const relation = useMemo(
    () =>
      selection === null || selection.kind === 'entity' ? null : readRelation(corpus, selection.id),
    [selection],
  );

  // No React render inside the tree that wraps the live element. A change of the selection
  // re-renders this route, and without this memo it would rebuild the element that owns the
  // canvas. The list is empty because the page takes nothing from this route. Do not remove it.
  const canvas = useMemo(() => <GraphPage />, []);

  // The row states a height. A flex row of automatic height grows to the tallest item, so
  // `overflow-y-auto` on the sidebar gives no scroll and the window scrolls both panes together.
  // `h-full` and not a calculation: `src/routes/__root.tsx` gives `<main>` the rest of the height.
  return (
    <div className={cn('flex h-full overflow-hidden')}>
      <div className={cn('min-h-0 min-w-0 flex-1')}>{canvas}</div>
      {/* **No selection draws no panel.** The canvas then takes the whole row, and
          `adapter` and `controller` each observe their own element, so the resize is answered. */}
      {dossier !== null ? (
        <Sidebar dossier={dossier} />
      ) : relation !== null ? (
        /* The same pane, at the same width, so the canvas never changes size on a selection. */
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
