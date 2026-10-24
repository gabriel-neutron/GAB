import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { useCallback, type ReactNode } from 'react';

import { readDossier, readRelation } from '@/features/detail/dossier';
import { RelationSidebar, Sidebar } from '@/features/detail/sidebar';
import { ArcCard, ExitCard } from '@/features/globe/link-card';
import type { Target } from '@/features/globe/globe-store';
import { globeData, type GlobeData } from '@/features/globe/globe-data';
import type { MapMode } from '@/features/globe/globe';
import { GlobePage } from '@/features/globe/globe-page';
import { loadCorpus } from '@/shared/read/corpus';
import { loadEntityTypes } from '@/shared/read/vocabulary';
import { ReleaseAbsent } from '@/shared/read/release-files';
import { loadRelease } from '@/shared/read/release-record';
import type { SiteRelease } from '@gab/release/site-release';

export interface MapSearch {
  /** The entity the reader selected. An empty string is the normal state of the map. */
  readonly entity: string;
  /** Absent for the flat map, which is the normal state, so a link to an entity names no mode. */
  readonly view?: 'globe';
}

// The globe is drawn from the release files, whether the read service answers or not, because the
// chain exists in a release and nowhere else. One release gives one derivation.
const derived = new WeakMap<SiteRelease, GlobeData>();

export const Route = createFileRoute('/map')({
  // The identity of what is examined lives in the address. The value comes from outside, so it is
  // validated before its first use, and it falls back instead of throwing. A key that an older
  // address carries (`relation`) is dropped here.
  validateSearch: (search: Record<string, unknown>): MapSearch => {
    const entity = search['entity'];
    return {
      entity: typeof entity === 'string' ? entity : '',
      ...(search['view'] === 'globe' ? { view: 'globe' as const } : {}),
    };
  },

  // An empty key never reaches the address bar.
  search: { middlewares: [stripSearchParams({ entity: '' })] },

  // The card of the map is the card of the graph, so it reads the same record. A record that does
  // not load leaves the map in place, and the card then says so.
  loader: async () => {
    const [corpus, types] = await Promise.all([
      loadCorpus().catch(() => null),
      loadEntityTypes().catch(() => null),
    ]);
    try {
      const release = await loadRelease();
      const held = derived.get(release) ?? globeData(release);
      derived.set(release, held);
      return { data: held, corpus, types };
    } catch (cause) {
      if (cause instanceof ReleaseAbsent) return { data: null, corpus, types };
      throw cause;
    }
  },

  component: MapRoute,
  head: () => ({ meta: [{ title: 'Map · GAB dataset' }] }),
});

function MapRoute() {
  const { entity, view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, corpus, types } = Route.useLoaderData();

  // The same panels as the graph: `Sidebar` for an entity and `RelationSidebar` for a link that is
  // a relation of the record. An exit point is computed by the release and is no record, so it
  // keeps its own card, and so does a link that the record does not hold.
  const cardOf = (target: Target): ReactNode => {
    if (target.kind === 'exit') {
      const exit = data?.exitInfo[target.id];
      return exit === undefined ? null : <ExitCard exit={exit} />;
    }
    if (target.kind === 'arc') {
      const relation = corpus === null ? null : readRelation(corpus, target.id);
      if (relation !== null) return <RelationSidebar relation={relation} showOn="graph" />;
      const arc = data?.arcInfo[target.id];
      return arc === undefined ? null : <ArcCard arc={arc} />;
    }
    const dossier =
      corpus === null || types === null ? null : readDossier(corpus, target.id, types, []);
    return dossier === null ? (
      <p aria-label="Detail" className="p-2">
        An entity is selected, and the read holds 0 records for it. The map draws it, and the detail
        read does not carry it.
      </p>
    ) : (
      <Sidebar dossier={dossier} showOn="graph" />
    );
  };

  // `replace: true`: a walk over twenty points would otherwise need twenty presses of the back
  // button to leave the map. It must be the same function at each render, because it is a prop of
  // the memoised canvas.
  const handleSelect = useCallback(
    (id: string | null) => {
      void navigate({ search: (held) => ({ ...held, entity: id ?? '' }), replace: true });
    },
    [navigate],
  );

  // A change of mode is a step the back button undoes.
  const handleMode = useCallback(
    (mode: MapMode) => {
      void navigate({
        search: (held) => ({ entity: held.entity, ...(mode === 'globe' ? { view: mode } : {}) }),
      });
    },
    [navigate],
  );

  return (
    <GlobePage
      data={data}
      entity={entity}
      cardOf={cardOf}
      onSelect={handleSelect}
      mode={view ?? 'map'}
      onMode={handleMode}
    />
  );
}
