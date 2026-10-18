import type { GlobeData } from './globe-data';
import { SanctionsRules } from '@/shared/page/sanctions-rules';

// A count and its noun, in the singular for one.
const count = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/** The text that tells how to read the map, in a panel that the reader opens. */
export function ReadingNotes({ data }: { readonly data: GlobeData }) {
  const { counts } = data;
  return (
    <details className="max-w-prose border border-border px-2 py-1">
      <summary className="cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        How to read this map
      </summary>
      <div className="flex flex-col gap-2 py-1">
        <p>
          The colour of a point is the stage of the chain of the asset. A grey point is an entity
          with no stage. Select a point for its card and its chain. A step of the strip puts its
          assets or its links forward. “Play the chain” goes through the six steps.
        </p>
        <p>
          {count(counts.arcsInReview, 'physical link is', 'physical links are')} in review: a grey
          dotted line labelled “in review”, not a fact. A light pulse runs along each other link
          that carries a flow. The pulse is a drawing aid, and it does not show a movement at this
          time. With no volume, a dashed line is a link after the export stage. An exit point is
          computed from the relations of the release, and is not an entity of the record.{' '}
          {count(counts.exitsInReview, 'exit point is', 'exit points are')} in review.
          {counts.exitsNotPlaced > 0
            ? ` ${count(counts.exitsNotPlaced, 'exit point has', 'exit points have')} no position and ${counts.exitsNotPlaced === 1 ? 'is' : 'are'} not on the map.`
            : ''}{' '}
          A position in the outline of another country is outside Russia. An asset with no position
          gives no exit point, and a link with an end that has no position is not on the map.
        </p>
        <p>
          {count(counts.arcsWithVolume, 'physical link has', 'physical links have')} a volume from
          the volume table of the research. A volume is an aggregate of the research for a period,
          not a fact of the record. A full line is an observed flow, and its width grows with its
          value, against the flows of the same unit only. A hatched line on a pale halo is an
          estimate, and the halo is its range. A thin hollow line is the nominal capacity of a
          pipeline, not a flow. A link with no volume has one width. Select a link for its value,
          its range, its period, its class and its source.
        </p>
        <SanctionsRules manifest={data.manifest} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Product chains">
          {counts.byProduct.map((one) => (
            <li key={one.label}>
              {one.label}: {count(one.links, 'link', 'links')}
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Stages of the chain">
          {counts.byStage.map((one) => (
            <li key={one.label}>
              {one.label}: {one.assets}
            </li>
          ))}
        </ul>
        <p>Basemap: outlines of the countries, Natural Earth (public domain).</p>
      </div>
    </details>
  );
}
