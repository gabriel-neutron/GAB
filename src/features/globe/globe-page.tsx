import { PageHeader } from '@/shared/page/page-header';
import { ReadingPage } from '@/shared/page/reading-page';
import { releaseDay } from '@gab/release/release-day';

import { Globe } from './globe';
import type { GlobeData } from './globe-data';
import { ReadingNotes } from './reading-notes';
import { TypeCountList } from './type-count-list';

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

const count = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/** The map page: the globe of the entities of the release that have a position, with the chain of
 * the hydrocarbons from the well to the exit from Russian control. */
export function GlobePage({ data, entity, entityHref, onSelect }: GlobePageProps) {
  if (data === null)
    return (
      <ReadingPage>
        <PageHeader title="Map" />
        <p className="text-muted-foreground">
          This site holds no release, and the map comes from a release.
        </p>
      </ReadingPage>
    );
  const { counts } = data;
  return (
    <ReadingPage>
      <PageHeader title="Map" detail={`From the release of ${releaseDay(data.date)}`} />
      <p className="max-w-prose">
        {count(counts.entities, 'entity of this release has', 'entities of this release have')}{' '}
        their own position, and {count(counts.arcs, 'physical link joins', 'physical links join')}{' '}
        two of them. A card gives the accepted facts first. A fact that is still in review carries
        the words “In review”: it is a proposal, not a fact.
      </p>
      <TypeCountList counts={counts.byType} />
      {entity !== '' && data.cards[entity] === undefined ? (
        <p role="status" className="text-candidate">
          The entity of the address has no position in this release, so the map does not show it.
        </p>
      ) : null}
      <ReadingNotes data={data} />
      <Globe data={data} entity={entity} entityHref={entityHref} onSelect={onSelect} />
    </ReadingPage>
  );
}
