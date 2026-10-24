import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { useCallback, useMemo, type ReactNode } from 'react';

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

import { mapCard, type MapRead } from './-map-card';

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

  // One value for one read, so the card below reads the record again only when the read changes.
  const read = useMemo(
    () => (corpus === null || types === null ? null : { corpus, types }),
    [corpus, types],
  );
  const cardOf = (target: Target): ReactNode => (
    <MapTargetCard target={target} data={data} read={read} />
  );

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

interface MapTargetCardProps {
  readonly target: Target;
  readonly data: GlobeData | null;
  readonly read: MapRead | null;
}

// The read walks the whole corpus, and the card renders at each change of the map store.
function MapTargetCard({ target, data, read }: MapTargetCardProps) {
  const card = useMemo(
    () => (data === null ? null : mapCard(target, data, read)),
    [target, data, read],
  );
  switch (card?.kind) {
    case 'entity':
      return <Sidebar dossier={card.dossier} showOn="graph" />;
    case 'relation':
      return <RelationSidebar relation={card.relation} showOn="graph" />;
    case 'arc':
      return <ArcCard arc={card.arc} />;
    case 'exit':
      return <ExitCard exit={card.exit} />;
    case 'no-read':
      return (
        <p aria-label="Detail" className="p-2">
          The detail read did not load, so the card of this entity cannot show.
        </p>
      );
    case 'no-record':
      return (
        <p aria-label="Detail" className="p-2">
          An entity is selected, and the read holds 0 records for it. The map draws it, and the
          detail read does not carry it.
        </p>
      );
    default:
      return null;
  }
}
