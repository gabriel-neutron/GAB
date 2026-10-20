import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { useCallback, useState } from 'react';

import { entityHref } from '@/features/detail/address';
import { keepFirstVisitClosed, readFirstVisitClosed } from '@/features/globe/first-visit';
import { globeData, type GlobeData } from '@/features/globe/globe-data';
import { GlobePage } from '@/features/globe/globe-page';
import { loadCorpus } from '@/shared/read/corpus';
import { ReleaseAbsent } from '@/shared/read/release-files';
import { loadRelease } from '@/shared/read/release-record';
import type { SiteRelease } from '@gab/release/site-release';

export interface MapSearch {
  /** The entity the reader selected. An empty string is the normal state of the map. */
  readonly entity: string;
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
    return { entity: typeof entity === 'string' ? entity : '' };
  },

  // An empty key never reaches the address bar.
  search: { middlewares: [stripSearchParams({ entity: '' })] },

  loader: async () => {
    // The record is read first, so the footer knows whether the service answers.
    await loadCorpus().catch(() => undefined);
    try {
      const release = await loadRelease();
      const held = derived.get(release) ?? globeData(release);
      derived.set(release, held);
      return held;
    } catch (cause) {
      if (cause instanceof ReleaseAbsent) return null;
      throw cause;
    }
  },

  component: MapRoute,
  head: () => ({ meta: [{ title: 'Map · GAB dataset' }] }),
});

function MapRoute() {
  const { entity } = Route.useSearch();
  const navigate = Route.useNavigate();
  const data = Route.useLoaderData();

  // `replace: true`: a walk over twenty points would otherwise need twenty presses of the back
  // button to leave the map. It must be the same function at each render, because it is a prop of
  // the memoised canvas.
  const handleSelect = useCallback(
    (id: string | null) => {
      void navigate({ search: { entity: id ?? '' }, replace: true });
    },
    [navigate],
  );

  // The answer is stored, so the card does not return after a reload. State holds it for the view.
  const [firstVisitClosed, setFirstVisitClosed] = useState(readFirstVisitClosed);
  const handleCloseFirstVisit = useCallback(() => {
    keepFirstVisitClosed();
    setFirstVisitClosed(true);
  }, []);

  return (
    <GlobePage
      data={data}
      entity={entity}
      entityHref={(id) => entityHref(id, null)}
      onSelect={handleSelect}
      onCloseFirstVisit={firstVisitClosed ? null : handleCloseFirstVisit}
    />
  );
}
