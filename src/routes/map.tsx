import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RelationSidebar, Sidebar } from '@/features/detail/sidebar';
import { readDossier, readRelation } from '@/features/detail/dossier';
import { MapPage } from '@/features/map/map-page';
import { UnplacedNotice } from '@/features/detail/unplaced-notice';
import { loadCorpus } from '@/shared/read/corpus';
import { loadEntityTypes } from '@/shared/read/vocabulary';

export interface MapSearch {
  /** The entity the analyst selected. An empty string is the normal state of a map. */
  readonly entity: string;
  // Both keys can carry a value at the same time: the map adapter keeps the selected
  // entity when a line is clicked, so the bright lines of that entity stay on the canvas. The
  // chosen relation is the later act, so the panel below draws the relation and not the entity.
  readonly relation: string;
}

export const Route = createFileRoute('/map')({
  // The identity of what is examined lives in the address. The value comes from
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
  // empty value that stayed there would be read as an identifier, which was the defect found on
  // the graph.
  search: { middlewares: [stripSearchParams({ entity: '', relation: '' })] },

  // The router draws no component until this answer arrives, and every reader below takes the
  // record from here as a value. So no reader on this surface can meet a record that is absent.
  loader: async () => {
    const [corpus, types] = await Promise.all([loadCorpus(), loadEntityTypes()]);
    return { corpus, types };
  },

  component: MapRoute,
  head: () => ({ meta: [{ title: 'Map · GAB dataset' }] }),
});

function MapRoute() {
  const { entity, relation } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { corpus, types } = Route.useLoaderData();

  // The address is the one carrier of the selection, and no React state holds a second copy.
  // The list of each callback below must stay `[navigate]`, so the values of this moment arrive
  // through a ref and never through the list.
  const current = useRef({ entity, relation });
  useEffect(() => void (current.current = { entity, relation }), [entity, relation]);

  // The adapter drops an entity or a relation it cannot draw, and the address loses it. So the
  // reason is read at the mount, and it dies with the view or at the next act of the analyst.
  const [unplaced, setUnplaced] = useState<string | null>(() => {
    const opened = readDossier(corpus, entity, types, []);
    if (opened !== null && !opened.drawnOnMap)
      return `${opened.label} has no position, so the map does not show it.`;
    const link = corpus.relations.find((one) => one.id === relation);
    if (link === undefined) return null;
    const placed = new Set(
      corpus.positions.flatMap((at) => (at.point === null ? [] : [at.entityId])),
    );
    return placed.has(link.srcId) && placed.has(link.dstId)
      ? null
      : 'This relation has an end with no position, so the map does not show it.';
  });
  // The notice goes at the next choice of an entity or a relation. A click on the ground with no
  // selection changes no selection, so the adapter calls no listener and the notice stays.

  // `replace: true`: a walk over twenty points would otherwise need twenty presses of the back
  // button to leave the map. It must be the same function at each render, because it is the one
  // prop of the memoised canvas below.
  const handleSelect = useCallback(
    (id: string | null) => {
      // `onSelect` calls a new listener at once with the selection of that moment, so a mount on
      // a plain `/map` would write `?entity=` before the analyst acts. A seed that differs still
      // writes: `adapter.ts` drops a restored identifier it cannot draw, and the address loses it.
      if (id !== null) setUnplaced(null);
      if ((id ?? '') === current.current.entity) return;
      // A new entity ends the choice of a relation: `adapter.ts` holds that rule for a click on
      // the canvas, but a click on the sidebar list picks a relation with no call into the
      // adapter, so this route must hold the rule too, or the panel keeps naming the old relation.
      void navigate({
        search: (previous: MapSearch): MapSearch => ({
          ...previous,
          entity: id ?? '',
          relation: '',
        }),
        replace: true,
      });
    },
    [navigate],
  );

  // The map adapter calls this with `null` when a click on a point or on the ground ends
  // the choice, so this route holds no second rule for that. The subscription delivers the choice
  // of the mount first, so a relation the canvas cannot draw arrives as `null` and leaves.
  const handleChooseRelation = useCallback(
    (id: string | null) => {
      if (id !== null) setUnplaced(null);
      if ((id ?? '') === current.current.relation) return;
      void navigate({
        search: (previous: MapSearch): MapSearch => ({ ...previous, relation: id ?? '' }),
        replace: true,
      });
    },
    [navigate],
  );

  // A stale identifier gives `null`, the route composes no sidebar, and the canvas keeps the full
  // width. There is no "not found" screen here: the map is still the answer. The read is memoised
  // because every other render of this route would otherwise walk the whole corpus again.
  // The side panel names no decision, so it reads no history: the entity page does.
  const dossier = useMemo(() => readDossier(corpus, entity, types, []), [corpus, entity, types]);

  const chosen = useMemo(() => readRelation(corpus, relation), [corpus, relation]);

  // No React re-render inside the tree that wraps the live element. Without this memo a selection
  // change would rebuild the element that owns the canvas. The list holds the three props the
  // canvas takes, and the record is the only one a selection cannot change.
  const canvas = useMemo(
    () => (
      <MapPage
        corpus={corpus}
        types={types}
        onSelect={handleSelect}
        onChooseRelation={handleChooseRelation}
      />
    ),
    [corpus, types, handleSelect, handleChooseRelation],
  );

  // The row states a height. A flex row of automatic height grows to the tallest item, so
  // `overflow-y-auto` on the sidebar gives no scroll and the window scrolls both panes together.
  // `h-full` and not a calculation: the root layout gives `<main>` the rest of the height.
  return (
    <div className="flex h-full overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1">{canvas}</div>
      {chosen !== null ? (
        <RelationSidebar relation={chosen} showOn="graph" />
      ) : dossier?.drawnOnMap === true ? (
        <Sidebar dossier={dossier} onSelectRelation={handleChooseRelation} showOn="graph" />
      ) : unplaced === null ? null : (
        <UnplacedNotice words={unplaced} />
      )}
    </div>
  );
}
