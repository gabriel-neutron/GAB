import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RelationSidebar, Sidebar } from '@/features/detail/sidebar';
import { readDossier, readRelation } from '@/features/detail/dossier';
import { MapPage } from '@/features/map/map-page';
import { loadCorpus } from '@/shared/read/corpus';
import { loadEntityTypes, loadVocabulary } from '@/shared/read/vocabulary';

export interface MapSearch {
  /** The entity the analyst selected. An empty string is the normal state of a map. */
  readonly entity: string;
  // Both keys can carry a value at the same time: `features/map/adapter.ts` keeps the selected
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
    const [corpus, vocabulary, types] = await Promise.all([
      loadCorpus(),
      loadVocabulary(),
      loadEntityTypes(),
    ]);
    return { corpus, vocabulary, types };
  },

  component: MapRoute,
  head: () => ({ meta: [{ title: 'Map · Gabriel' }] }),
});

function MapRoute() {
  const { entity, relation } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { corpus, vocabulary, types } = Route.useLoaderData();

  // The address is the one carrier of the selection, and no React state holds a second copy.
  // The list of each callback below must stay `[navigate]`, so the values of this moment arrive
  // through a ref and never through the list.
  const current = useRef({ entity, relation });
  useEffect(() => void (current.current = { entity, relation }), [entity, relation]);

  // `replace: true`: a walk over twenty points would otherwise need twenty presses of the back
  // button to leave the map. It must be the same function at each render, because it is the one
  // prop of the memoised canvas below.
  const handleSelect = useCallback(
    (id: string | null) => {
      // `onSelect` calls a new listener at once with the selection of that moment, so a mount on
      // a plain `/map` would write `?entity=` before the analyst acts. A seed that differs still
      // writes: `adapter.ts` drops a restored identifier it cannot draw, and the address loses it.
      if ((id ?? '') === current.current.entity) return;
      void navigate({
        search: (previous: MapSearch): MapSearch => ({ ...previous, entity: id ?? '' }),
        replace: true,
      });
    },
    [navigate],
  );

  // `features/map/adapter.ts` calls this with `null` when a click on a point or on the ground ends
  // the choice, so this route holds no second rule for that. The subscription delivers the choice
  // of the mount first, so a relation the canvas cannot draw arrives as `null` and leaves.
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

  // A stale identifier gives `null`, the route composes no sidebar, and the canvas keeps the full
  // width. There is no "not found" screen here: the map is still the answer. The read is memoised
  // because every other render of this route would otherwise walk the whole corpus again.
  const dossier = useMemo(
    () => readDossier(corpus, entity, vocabulary),
    [corpus, entity, vocabulary],
  );

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
  // `h-full` and not a calculation: `src/routes/__root.tsx` gives `<main>` the rest of the height.
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
