import { AssetCard } from './asset-card.tsx';
import type { ChainView } from './chain-card.ts';
import { STAGES } from './chain-stage.ts';
import { CARD_ELEMENT, CARDS_ELEMENT, MAP_ELEMENT } from './map-elements.ts';
import { mapFeatures } from './map-features.ts';
import { SiteFrame } from './site-frame.tsx';
import { entityPage, hrefFrom, MAP } from './site-paths.ts';
import type { SiteRelease } from './site-release.ts';
import { CELL, HEAD, LINK, TABLE, TABLE_HEAD } from './site-style.ts';

/** The map page: the entities of the release that have a position, drawn by the map script over
 * a basemap with a colour for each stage of the chain, with a card for the selected entity, and
 * listed below the map with a link to each page. */
export function MapPage({
  release,
  view,
}: {
  readonly release: SiteRelease;
  readonly view: ChainView;
}) {
  const features = mapFeatures(release.geojson);
  return (
    <SiteFrame release={release} page={{ path: MAP, title: 'Map' }}>
      <p className="max-w-prose">
        {features.length} entities of this release have their own position. The colour of a point is
        the stage of the chain of the asset. A grey point is an entity with no stage. Select a point
        for its card. A card gives the accepted facts first. A fact that is still in review carries
        the words “In review”: it is a proposal, not a fact.
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Stages of the chain">
        {STAGES.map((one) => (
          <li key={one.key} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: one.colour }}
            />
            {one.label}: {view.counts.get(one.key) ?? 0}
          </li>
        ))}
      </ul>
      <p className="max-w-prose">
        Basemap: outlines of the countries, Natural Earth (public domain).
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div
          id={MAP_ELEMENT}
          role="region"
          aria-label="Map of the entities with a position"
          className="h-120 w-full border border-border bg-muted"
        />
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
                <td className={CELL}>{view.cards[one.id]?.stage}</td>
                <td className={CELL}>{one.geometry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SiteFrame>
  );
}
