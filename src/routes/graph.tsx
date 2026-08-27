import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { readDossier, readRelation } from '@/features/detail/dossier';
import { RelationSidebar, Sidebar } from '@/features/detail/sidebar';
import { onGraphSelection, type GraphSelection } from '@/features/graph/bridge';
import { GraphPage } from '@/features/graph/graph-page';
import { loadCorpus } from '@/shared/read/corpus';
import { loadEntityTypes, loadVocabulary } from '@/shared/read/vocabulary';
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

  // An empty key never reaches the address bar. The controller reads the address itself, and it
  // writes a clean one, so without this a link into the graph left a pair of keys that the
  // canvas removes on its first act, and the two writers stated two different addresses.
  search: { middlewares: [stripSearchParams({ entity: '', relation: '' })] },

  // The router draws no component until this answer arrives, and every reader below takes the
  // record from here as a value. So no reader on this surface can meet a record that is absent.
  loader: async () => {
    const [corpus, vocabulary, types] = await Promise.all([
      loadCorpus(),
      loadVocabulary(),
      loadEntityTypes(),
    ]);
    return { corpus, vocabulary, types };
  },

  component: GraphRoute,
  head: () => ({ meta: [{ title: 'Graph · Gabriel' }] }),
});

function GraphRoute() {
  const { corpus, vocabulary, types } = Route.useLoaderData();

  // Do not seed this state from `Route.useSearch()`. The canvas is the authority on what it drew,
  // and a second reader of the address gave the route and the canvas two different answers.
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  // This state sits in an ancestor of the live canvas, and `canvas` below is memoised on the
  // record alone, so no render that follows a selection rebuilds the element. `onGraphSelection`
  // seeds a new listener with the selection of the moment, so the effect below restores it.
  useEffect(() => onGraphSelection(setSelection), []);

  // The read is memoised: every other render of this route would walk the whole corpus again.
  const dossier = useMemo(
    () =>
      selection === null || selection.kind === 'relation'
        ? null
        : readDossier(corpus, selection.id, vocabulary),
    [corpus, selection, vocabulary],
  );

  const relation = useMemo(
    () =>
      selection === null || selection.kind === 'entity' ? null : readRelation(corpus, selection.id),
    [corpus, selection],
  );

  // No React render inside the tree that wraps the live element. A change of the selection
  // re-renders this route, and without this memo it would rebuild the element that owns the
  // canvas. The list holds the record, which a selection never changes. Do not remove it.
  const canvas = useMemo(() => <GraphPage corpus={corpus} types={types} />, [corpus, types]);

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
