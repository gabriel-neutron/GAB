import { ReadingPage } from '@/shared/page/reading-page';

import { Globe } from './globe';
import type { GlobeData } from './globe-data';

export interface GlobePageProps {
  /** Null when the site holds no release: the map comes from a release and from nothing else. */
  readonly data: GlobeData | null;
  /** The entity of the address, or an empty string. */
  readonly entity: string;
  /** The address of the page of one entity. */
  readonly entityHref: (id: string) => string;
  /** This function must be the same function at each render of the caller. */
  readonly onSelect: (id: string | null) => void;
}

/** The map page: the globe of the entities of the release that have a position, with the chain of
 * the hydrocarbons from the well to the exit from Russian control. */
export function GlobePage({ data, entity, entityHref, onSelect }: GlobePageProps) {
  if (data === null)
    return (
      <ReadingPage>
        <h1 className="sr-only">Map</h1>
        <p className="text-muted-foreground">
          This site holds no release, and the map comes from a release.
        </p>
      </ReadingPage>
    );
  return (
    <div className="workspace-page">
      <h1 className="sr-only">Map</h1>
      {entity !== '' && data.cards[entity] === undefined ? (
        <p role="status" className="text-candidate">
          The entity of the address has no position in this release, so the map does not show it.
        </p>
      ) : null}
      <Globe data={data} entity={entity} entityHref={entityHref} onSelect={onSelect} />
    </div>
  );
}
