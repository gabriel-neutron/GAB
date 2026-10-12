import { MAP_ELEMENT } from './map-elements.ts';
import { mapFeatures } from './map-features.ts';
import { SiteFrame } from './site-frame.tsx';
import { entityPage, hrefFrom, MAP } from './site-paths.ts';
import type { SiteRelease } from './site-release.ts';
import { CELL, HEAD, LINK, TABLE, TABLE_HEAD } from './site-style.ts';

/** The map page: the entities of the release that have a position, drawn by the map script over
 * a plain ground, and listed below the map with a link to each page. */
export function MapPage({ release }: { readonly release: SiteRelease }) {
  const features = mapFeatures(release.geojson);
  return (
    <SiteFrame release={release} page={{ path: MAP, title: 'Map' }}>
      <p className="max-w-prose">
        {features.length} entities of this release have their own position. The map draws them over
        a plain ground with lines of latitude and longitude every 10 degrees, and no basemap. Select
        a point for its name and its page.
      </p>
      <div
        id={MAP_ELEMENT}
        role="region"
        aria-label="Map of the entities with a position"
        className="h-120 w-full border border-border bg-muted"
      />
      <div className="max-w-full overflow-x-auto">
        <table className={TABLE}>
          <thead className={TABLE_HEAD}>
            <tr>
              <th className={HEAD}>Entity</th>
              <th className={HEAD}>Type</th>
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
                <td className={CELL}>{one.geometry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SiteFrame>
  );
}
