import { AssetCard } from './asset-card.tsx';
import type { ChainView } from './chain-card.ts';
import type { ChainFlows } from './chain-flows.ts';
import { PRODUCTS } from './chain-product.ts';
import { STAGES } from './chain-stage.ts';
import { CARD_ELEMENT, CARDS_ELEMENT, MAP_ELEMENT } from './map-elements.ts';
import { mapFeatures } from './map-features.ts';
import { SiteFrame } from './site-frame.tsx';
import { entityPage, hrefFrom, MAP } from './site-paths.ts';
import type { SiteRelease } from './site-release.ts';
import { CELL, HEAD, LINK, TABLE, TABLE_HEAD } from './site-style.ts';

// The map script reads `aria-pressed` and sets it, so the page needs no script to render.
const CONTROL =
  'h-6 border border-input bg-background px-1.5 text-small/4 aria-pressed:bg-foreground aria-pressed:text-background focus-visible:outline-2 focus-visible:outline-ring';
const STAGE_CONTROL =
  'flex w-full items-center gap-1.5 border border-input bg-background px-1.5 py-1 text-left text-small/4 aria-pressed:bg-foreground aria-pressed:text-background focus-visible:outline-2 focus-visible:outline-ring';

/** The map page: the entities of the release that have a position over a basemap, with a colour
 * for each stage of the chain, the physical links as arcs, the exit points, a filter of the
 * product chain, a strip of the six stages, and a card for the selected entity. The entities are
 * listed below the map with a link to each page. */
export function MapPage({
  release,
  view,
  flows,
}: {
  readonly release: SiteRelease;
  readonly view: ChainView;
  readonly flows: ChainFlows;
}) {
  const features = mapFeatures(release.geojson);
  const exitsInReview = flows.exits.filter((one) => one.inReview).length;
  const exitsNotPlaced = flows.exits.filter((one) => one.position === null).length;
  const arcsInReview = flows.arcs.filter((one) => one.inReview).length;
  const arcsWithVolume = flows.arcs.filter((one) => one.volume !== null).length;
  return (
    <SiteFrame release={release} page={{ path: MAP, title: 'Map' }}>
      <p className="max-w-prose">
        {features.length} entities of this release have their own position. The colour of a point is
        the stage of the chain of the asset. A grey point is an entity with no stage. Select a point
        for its card and its chain. A card gives the accepted facts first. A fact that is still in
        review carries the words “In review”: it is a proposal, not a fact.
      </p>
      <p className="max-w-prose">
        {flows.arcs.length} physical links join two assets with a position. {arcsInReview} of them
        are in review: a grey dotted line labelled &quot;in review&quot;, not a fact. With no
        volume, a dashed line is a link after the export stage. An exit point is computed from the
        relations of the release, and is not an entity of the record. {exitsInReview} exit points
        are in review.
        {exitsNotPlaced > 0
          ? ` ${String(exitsNotPlaced)} exit points have no position and are not on the map.`
          : ''}{' '}
        A position in the outline of another country is outside Russia.
      </p>
      <p className="max-w-prose">
        {arcsWithVolume} physical links have a volume from the volume table of the research. A
        volume is an aggregate of the research for a period, not a fact of the record. A full line
        is an observed flow, and its width grows with its value, against the flows of the same unit
        only. A hatched line on a pale halo is an estimate, and the halo is its range. A thin hollow
        line is the nominal capacity of a pipeline, not a flow. A link with no volume has one width.
        Select a link for its value, its range, its period, its class and its source.
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Product chains">
        {PRODUCTS.map((one) => (
          <li key={one.key} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-4"
              style={{ backgroundColor: one.colour }}
            />
            {one.label}: {flows.arcs.filter((arc) => arc.product === one.key).length} links
          </li>
        ))}
      </ul>
      <p className="max-w-prose">
        Basemap: outlines of the countries, Natural Earth (public domain).
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex h-120 w-full flex-col border border-border bg-muted">
          <div className="relative min-h-0 flex-1">
            <div
              id={MAP_ELEMENT}
              role="region"
              aria-label="Map of the entities with a position"
              className="size-full"
            />
            <div
              role="group"
              aria-label="Product chain"
              className="absolute top-2 left-2 flex flex-wrap gap-1"
            >
              <button type="button" className={CONTROL} data-product="all" aria-pressed="true">
                All
              </button>
              {PRODUCTS.map((one) => (
                <button
                  key={one.key}
                  type="button"
                  className={CONTROL}
                  data-product={one.key}
                  aria-pressed="false"
                >
                  {one.label}
                </button>
              ))}
            </div>
          </div>
          <ol
            aria-label="Stages of the chain"
            className="grid grid-cols-3 gap-1 border-t border-border p-1 lg:grid-cols-6"
          >
            {STAGES.map((one) => (
              <li key={one.key}>
                <button
                  type="button"
                  className={STAGE_CONTROL}
                  data-stage={one.key}
                  aria-pressed="false"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: one.colour }}
                  />
                  <span className="min-w-0">
                    {one.label}: {flows.counts.get(one.key) ?? 0}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div
          id={CARD_ELEMENT}
          role="region"
          aria-label="Card of the selected entity"
          className="max-h-120 overflow-y-auto border border-border p-2"
        >
          <p>Select a point on the map.</p>
        </div>
      </div>
      <div id={CARDS_ELEMENT} hidden>
        {features.map((one) => {
          const card = view.cards[one.id];
          return card === undefined ? null : (
            <div key={one.id} data-card={one.id}>
              <AssetCard card={card} />
            </div>
          );
        })}
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className={TABLE}>
          <thead className={TABLE_HEAD}>
            <tr>
              <th className={HEAD}>Entity</th>
              <th className={HEAD}>Type</th>
              <th className={HEAD}>Stage</th>
              <th className={HEAD}>Geometry</th>
            </tr>
          </thead>
          <tbody>
            {features.map((one) => (
              <tr key={one.id} className="border-b border-border">
                <td className={CELL}>
                  <a className={LINK} href={hrefFrom(MAP, entityPage(one.id))}>
                    {one.label}
                  </a>
                </td>
                <td className={CELL}>{one.type}</td>
                <td className={CELL}>
                  {STAGES.find((stage) => stage.key === flows.stages.get(one.id))?.label ??
                    view.cards[one.id]?.stage}
                </td>
                <td className={CELL}>{one.geometry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SiteFrame>
  );
}
