import plantsRaw from './data/atlas-plants.csv?raw';
import land from './basemap-data';
import { readCsv } from './line-panel';

// The Russian defence plants and integrators that receive foreign components, by main weapon. A plant with
// an approximate point draws hollow; a plant with no point is left out.
const plants = readCsv(plantsRaw);
// Map of Russia: equirectangular, longitude 27-142 E, latitude 42-70 N.
// Height for a true shape at about 56 N: 640 px for 115 degrees of longitude at cos(56) gives 9.95 px a degree.
const MAP = { lon0: 27, lon1: 142, lat0: 42, lat1: 70, x: 0, y: 24, w: 640, h: 279 };
const px = (lon: number, lat: number) => [
  MAP.x + ((lon - MAP.lon0) / (MAP.lon1 - MAP.lon0)) * MAP.w,
  MAP.y + ((MAP.lat1 - lat) / (MAP.lat1 - MAP.lat0)) * MAP.h,
];
const landPath = land.polygons
  .map(
    (ring) =>
      ring
        .map(
          ([lon, lat], i) =>
            `${i ? 'L' : 'M'}${px(lon ?? 0, lat ?? 0)
              .map((v) => v.toFixed(1))
              .join(',')}`,
        )
        .join('') + 'Z',
  )
  .join('');
const GLYPH: Record<string, string> = {
  drone: 'M0,-5L5,4H-5Z',
  'cruise missile': 'M0,-5L5,0L0,5L-5,0Z',
  'ballistic missile': 'M0,-5L5,0L0,5L-5,0Z',
  'guided bomb': 'M-4,-4H4V4H-4Z',
  armour: 'M-5,-3H5V3H-5Z',
  aircraft: 'M-5,3L0,-4L5,3L0,0Z',
};
const LABELS = ['Alabuga SEZ', 'IEMZ Kupol', 'KTRV', 'STC', 'Kalashnikov', 'Uralvagonzavod'];
// The most specific weapon of a plant gives its glyph: a drone plant with other lines shows as a drone.
const PRIORITY = [
  'drone',
  'cruise missile',
  'ballistic missile',
  'guided bomb',
  'aircraft',
  'armour',
];

export function PlantsMapFigure() {
  const at = (name: string) => {
    const p = plants.find((x) => (x['entity'] ?? '').startsWith(name) && x['lat']);
    return p ? px(Number(p['lon']), Number(p['lat'])) : undefined;
  };
  // Two plants in one town (Izhevsk) sit on the same point: the later number moves below left.
  const near = (i: number) =>
    LABELS.slice(0, i).some((other) => {
      const a = at(other),
        b = at(LABELS[i] ?? '');
      return a && b && Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0)) < 10;
    });
  return (
    <figure className="report-chart">
      <svg
        viewBox="0 0 640 440"
        role="img"
        aria-label="Russian defence plants by main weapon; six main plants numbered; hollow points are approximate"
      >
        <text x={MAP.x} y="12" className="lp-axis">
          defence plants and integrators by main weapon
        </text>
        <clipPath id="plants-map">
          <rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} />
        </clipPath>
        <path d={landPath} className="atlas-land" clipPath="url(#plants-map)" />
        {plants
          .filter((p) => p['lat'])
          .map((p, i) => {
            const [x, y] = px(Number(p['lon']), Number(p['lat']));
            const types = (p['weapon_type'] ?? '').split(/[;,]/).map((t) => t.trim());
            const type = PRIORITY.find((t) => types.includes(t)) ?? 'other';
            return (
              <g
                key={i}
                transform={`translate(${x},${y})`}
                className={p['position_basis'] === 'lead' ? 'atlas-plant lead' : 'atlas-plant'}
              >
                {GLYPH[type] ? <path d={GLYPH[type]} /> : <circle r="3" />}
              </g>
            );
          })}
        {LABELS.map((name, i) => {
          const p = plants.find((x) => (x['entity'] ?? '').startsWith(name) && x['lat']);
          if (!p) return null;
          const [x, y] = px(Number(p['lon']), Number(p['lat']));
          // Labels go to a list under the map, with a number on the point: the plants sit close together.
          return (
            <g key={name}>
              <text
                x={(x ?? 0) + (near(i) ? -12 : 5)}
                y={(y ?? 0) + (near(i) ? 12 : -5)}
                className="atlas-num"
              >
                {i + 1}
              </text>
              <text
                x={MAP.x + (i % 2) * 320}
                y={MAP.y + MAP.h + 24 + Math.floor(i / 2) * 16}
                className="lp-axis atlas-place"
              >
                {i + 1} {(p['entity'] ?? '').split(' (')[0]} ({p['city']})
              </text>
            </g>
          );
        })}
        <g transform={`translate(${MAP.x + 6},${MAP.y + MAP.h + 86})`}>
          {[
            ['drone', 'Drones'],
            ['cruise missile', 'Missiles'],
            ['guided bomb', 'Guided bombs'],
            ['armour', 'Armour'],
            ['aircraft', 'Aircraft'],
            ['other', 'Other'],
          ].map(([k, label], i) => (
            <g
              key={k}
              transform={`translate(${(i % 4) * 140},${Math.floor(i / 4) * 18})`}
              className="atlas-plant"
            >
              {GLYPH[k ?? ''] ? <path d={GLYPH[k ?? '']} /> : <circle r="3" />}
              <text x="10" y="4" className="lp-axis">
                {label}
              </text>
            </g>
          ))}
          <g transform="translate(280,18)" className="atlas-plant lead">
            <circle r="3" />
            <text x="10" y="4" className="lp-axis">
              hollow: approximate point
            </text>
          </g>
        </g>
      </svg>
    </figure>
  );
}
