import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { readDossier, readRelation } from '@/features/detail/dossier';
import { RelationSidebar, Sidebar } from '@/features/detail/sidebar';
import type { GraphSelection } from '@/features/graph/selection';
import { GraphPage } from '@/features/graph/graph-page';
import { PageHeader } from '@/shared/page/page-header';
import { ReadingPage } from '@/shared/page/reading-page';
import { loadCorpus } from '@/shared/read/corpus';
import { loadLayout } from '@/shared/read/layout';
import { useReleaseNote } from '@/shared/read/release-note';
import { loadEntityTypes } from '@/shared/read/vocabulary';
import { releaseDay } from '@gab/release/release-day';

// Departure: the address is the one store of what is examined. A write through the router
// re-renders this route and destroys the canvas, so the canvas controller writes the address
// itself with `history.replaceState`.
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
    const [corpus, types] = await Promise.all([loadCorpus(), loadEntityTypes()]);
    return { corpus, types, layout: await loadLayout(corpus.entities) };
  },

  component: GraphRoute,
  head: () => ({ meta: [{ title: 'Graph · GAB dataset' }] }),
});

const count = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

function GraphRoute() {
  const record = Route.useLoaderData();
  const releaseNote = useReleaseNote();
  const { corpus, types } = record;

  // Do not seed this state from `Route.useSearch()`. The canvas is the authority on what it drew,
  // and a second reader of the address gave the route and the canvas two different answers.
  // `setSelection` is the same function at every render, so the canvas below is mounted one time.
  const [selection, setSelection] = useState<GraphSelection | null>(null);

  // The read is memoised: every other render of this route would walk the whole corpus again.
  const dossier = useMemo(
    () =>
      selection === null || selection.kind === 'relation'
        ? null
        : // The side panel names no decision, so it reads no history: the entity page does.
          readDossier(corpus, selection.id, types, []),
    [corpus, selection, types],
  );

  const relation = useMemo(
    () =>
      selection === null || selection.kind === 'entity' ? null : readRelation(corpus, selection.id),
    [corpus, selection],
  );

  // The card stands in the island at all times, so a selection never changes the size of the
  // canvas. The page re-renders with the selection, and the live element is held by its own memo.
  const card =
    dossier !== null ? (
      <Sidebar dossier={dossier} showOn="map" />
    ) : relation !== null ? (
      <RelationSidebar relation={relation} />
    ) : selection === null ? (
      <p className="p-2">Select a node or a relation on the graph, or a name in the list.</p>
    ) : (
      <p aria-label="Detail" className="p-2">
        {reportOf(selection)}
      </p>
    );

  // The words state what the page draws. Where the files of a release are read, the page names
  // the release. Where the service answers, it names no date and does not call the record live.
  return (
    <ReadingPage>
      {releaseNote === null ? (
        <PageHeader title="Graph" />
      ) : (
        <PageHeader title="Graph" detail={`From the release of ${releaseDay(releaseNote.date)}`} />
      )}
      <p className="max-w-prose">
        {count(corpus.entities.length, 'entity is', 'entities are')} drawn as a node, and{' '}
        {count(corpus.relations.length, 'relation joins', 'relations join')} two of them with a
        line. The graph opens on a choice of an entity, and then draws that entity with its
        neighbours. Select a node, a line or a name in the list to read its record. The types switch
        off what they hold, and the field in the header narrows the lists.
      </p>
      <GraphPage record={record} onSelect={setSelection} card={card} />
    </ReadingPage>
  );
}
