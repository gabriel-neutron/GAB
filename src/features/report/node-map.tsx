import land from './basemap-data';
import { ui } from './content';

// The basemap of the report is equirectangular over its box, at 5 units for one degree.
const [WEST, , , NORTH] = land.bbox;
const SCALE = 5;
const x = (lon: number) => (lon - (WEST ?? 0)) * SCALE;
const y = (lat: number) => ((NORTH ?? 0) - lat) * SCALE;
const LAND = land.polygons
  .map(
    (ring) =>
      ring.map(([lon = 0, lat = 0], i) => `${i ? 'L' : 'M'}${x(lon)},${y(lat)}`).join('') + 'Z',
  )
  .join('');
const SPAN = 120;

/** A small map around one position. It loads with the panel, never with the page. */
export function NodeMap({
  lat,
  lon,
  name,
}: {
  readonly lat: number;
  readonly lon: number;
  readonly name: string;
}) {
  const cx = x(lon);
  const cy = y(lat);
  return (
    <figure>
      <svg
        role="img"
        aria-label={`${ui.panel.placeLabel}: ${name}`}
        viewBox={`${cx - SPAN} ${cy - SPAN / 2} ${SPAN * 2} ${SPAN}`}
        className="w-full border border-border bg-map-water"
      >
        <path d={LAND} fill="var(--map-land)" stroke="var(--map-boundary)" strokeWidth={0.3} />
        <circle cx={cx} cy={cy} r={2.5} fill="var(--signal)" />
        <circle cx={cx} cy={cy} r={6} fill="none" stroke="var(--signal)" strokeWidth={0.6} />
      </svg>
      <figcaption className="mt-1 font-mono text-data text-label tabular-nums">
        {Math.abs(lat).toFixed(2)} {lat >= 0 ? 'N' : 'S'} · {Math.abs(lon).toFixed(2)}{' '}
        {lon >= 0 ? 'E' : 'W'} · {land.source}
      </figcaption>
    </figure>
  );
}
