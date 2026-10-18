import { AssetCard } from './asset-card.tsx';
import type { ChainView } from './chain-card.ts';
import type { ChainFlows } from './chain-flows.ts';
import { PRODUCTS } from '@gab/proposal/chain-product';
import { STAGES } from '@gab/proposal/chain-stage';
import { chainSteps } from '@gab/proposal/chain-steps';
import {
  CAPTION_ELEMENT,
  CARD_ELEMENT,
  CARDS_ELEMENT,
  MAP_ELEMENT,
  NO_MAP_ELEMENT,
} from './map-elements.ts';
import { mapFeatures } from './map-features.ts';
import { SiteFrame } from './site-frame.tsx';
import { entityPage, hrefFrom, MAP, METHOD } from './site-paths.ts';
import type { SiteRelease } from './site-release.ts';
import { CELL, HEAD, LINK, TABLE, TABLE_HEAD } from './site-style.ts';

// The map script reads `aria-pressed` and sets it, so the page needs no script to render.
const CONTROL =
  'flex h-6 items-center gap-1.5 border border-input bg-background px-1.5 text-small/4 aria-pressed:bg-foreground aria-pressed:text-background focus-visible:outline-2 focus-visible:outline-ring';
const STEP_CONTROL =
  'flex w-full items-center gap-1.5 border border-input bg-background px-1.5 py-1 text-left text-small/4 aria-pressed:bg-foreground aria-pressed:text-background focus-visible:outline-2 focus-visible:outline-ring';

// A count and its noun, in the singular for one.
const count = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

const Swatch = ({ colour, round }: { readonly colour: string; readonly round: boolean }) => (
  <span
    aria-hidden="true"
    className={round ? 'inline-block size-2.5 shrink-0 rounded-full' : 'inline-block h-0.5 w-4'}
    style={{ backgroundColor: colour }}
  />
);

/** The map page: a globe of the entities of the release that have a position, with a colour for
 * each stage of the chain, the physical links as arcs, the exit points, a filter of the product
 * chain, a strip of the six steps of the chain, and a card for the selected entity. The text that
 * tells how to read the map is in a panel that the reader opens. The entities are listed below the
 * map with a link to each page. */
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
  const steps = chainSteps(flows);
  const exitsInReview = flows.exits.filter((one) => one.inReview).length;
  const exitsNotPlaced = flows.exits.filter((one) => one.position === null).length;
  const arcsInReview = flows.arcs.filter((one) => one.inReview).length;
  const arcsWithVolume = flows.arcs.filter((one) => one.volume !== null).length;
  return (
    <SiteFrame release={release} page={{ path: MAP, title: 'Map' }}>
      <p className="max-w-prose">
        {count(features.length, 'entity of this release has', 'entities of this release have')}{' '}
        their own position, and{' '}
        {count(flows.arcs.length, 'physical link joins', 'physical links join')} two of them. A card
        gives the accepted facts first. A fact that is still in review carries the words “In
        review”: it is a proposal, not a fact.
      </p>
      <details className="max-w-prose border border-border px-2 py-1">
        <summary className="cursor-pointer focus-visible:outline-2 focus-visible:outline-ring">
          How to read this map
        </summary>
        <div className="flex flex-col gap-2 py-1">
          <p>
            The colour of a point is the stage of the chain of the asset. A grey point is an entity
            with no stage. Select a point for its card and its chain. A step of the strip puts its
            assets or its links forward. “Play the chain” goes through the six steps.
          </p>
          <p>
            {count(arcsInReview, 'physical link is', 'physical links are')} in review: a grey dotted
            line labelled &quot;in review&quot;, not a fact. A light pulse runs along each other
            link. With no volume, a dashed line is a link after the export stage. An exit point is
            computed from the relations of the release, and is not an entity of the record.{' '}
            {count(exitsInReview, 'exit point is', 'exit points are')} in review.
            {exitsNotPlaced > 0
              ? ` ${count(exitsNotPlaced, 'exit point has', 'exit points have')} no position and ${exitsNotPlaced === 1 ? 'is' : 'are'} not on the map.`
              : ''}{' '}
            A position in the outline of another country is outside Russia. An asset with no
            position gives no exit point, and a link with an end that has no position is not on the
            map.
          </p>
          <p>
            {count(arcsWithVolume, 'physical link has', 'physical links have')} a volume from the
            volume table of the research. A volume is an aggregate of the research for a period, not
            a fact of the record. A full line is an observed flow, and its width grows with its
            value, against the flows of the same unit only. A hatched line on a pale halo is an
            estimate, and the halo is its range. A thin hollow line is the nominal capacity of a
            pipeline, not a flow. A link with no volume has one width. Select a link for its value,
            its range, its period, its class and its source.
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Product chains">
            {PRODUCTS.map((one) => (
              <li key={one.key}>
                {one.label}:{' '}
                {count(flows.arcs.filter((arc) => arc.product === one.key).length, 'link', 'links')}
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Stages of the chain">
            {STAGES.map((one) => (
              <li key={one.key}>
                {one.label}: {flows.counts.get(one.key) ?? 0}
              </li>
            ))}
          </ul>
          <p>
            Basemap: outlines of the countries, Natural Earth (public domain). The{' '}
            <a className={LINK} href={hrefFrom(MAP, METHOD)}>
              Method page
            </a>{' '}
            gives the full method.
          </p>
        </div>
      </details>
      <div className="dark grid border border-border bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex h-160 w-full flex-col">
          <div className="relative min-h-0 flex-1">
            <div
              id={MAP_ELEMENT}
              role="region"
              aria-label="Map of the entities with a position"
              className="size-full"
            />
            <p
              id={NO_MAP_ELEMENT}
              hidden
              className="absolute inset-0 flex items-center justify-center p-4 text-center"
            >
              This browser cannot draw the map, because it has no WebGL. The list of the entities is
              below the map.
            </p>
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
                  <Swatch colour={one.colour} round={false} />
                  {one.label}
                </button>
              ))}
            </div>
            <p
              id={CAPTION_ELEMENT}
              role="status"
              className="absolute right-2 bottom-2 left-2 max-w-prose border border-border bg-background px-1.5 py-1 empty:hidden"
            />
          </div>
          <div className="flex flex-col gap-1 border-t border-border p-1 lg:flex-row">
            <button type="button" className={CONTROL} data-play>
              Play the chain
            </button>
            <button type="button" className={CONTROL} data-motion aria-pressed="false">
              Stop motion
            </button>
            <ol
              aria-label="Steps of the chain"
              className="grid flex-1 grid-cols-3 gap-1 lg:grid-cols-6"
            >
              {steps.map((one) => (
                <li key={one.key}>
                  <button
                    type="button"
                    className={STEP_CONTROL}
                    data-step={one.key}
                    aria-pressed="false"
                  >
                    <Swatch
                      colour={STAGES.find((stage) => stage.key === one.stage)?.colour ?? ''}
                      round
                    />
                    <span className="min-w-0">
                      {one.label}: {one.count}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div
          id={CARD_ELEMENT}
          role="region"
          aria-label="Card of the selected entity"
          className="max-h-160 overflow-y-auto border-t border-border p-2 lg:border-t-0 lg:border-l"
        >
          <p>Select a point on the map.</p>
        </div>
      </div>
      <div id={CARDS_ELEMENT} hidden>
        {features.map((one) => {
          const card = view.cards[one.id];
          return card === undefined ? null : (
            <div key={one.id} data-card={one.id}>
              <AssetCard card={card} stage={flows.stages.get(one.id) ?? null} />
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
                  {STAGES.find((stage) => stage.key === flows.stages.get(one.id))?.label}
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
