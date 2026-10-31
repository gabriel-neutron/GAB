import stagesRaw from './data/atlas-stages.csv?raw';
import plantsRaw from './data/atlas-plants.csv?raw';
import land from './basemap-data';
import { readCsv } from './line-panel';

// The supply-chain atlas (a double page): brand → made → sold → shipped → Russian plants.
// Each column is 100 % of one stage, with the same country groups in the same order; a band joins the share
// of one group from a stage to the next (a share, not a flow of the same goods). A group that a source does
// not state is absent from its column, not a zero. Brand, made and sold: the same goods (Russian customs,
// 2023); shipped: mirror exports of the CHP list (2025). The catalogue of identified components stands apart:
// it is a selective catalogue by maker headquarters, not a measure of trade. The source of each value is in
// the data files. A plant with an approximate point draws hollow.
const stages = readCsv(stagesRaw);
const plants = readCsv(plantsRaw);
const GROUPS = [
  { key: 'United States', tone: 'us' },
  { key: 'EU', tone: 'eu' },
  { key: 'Taiwan', tone: 'coal' },
  { key: 'Other coalition', tone: 'coal' },
  { key: 'China, Hong Kong', tone: 'cn' },
  { key: 'Other', tone: 'rest' },
  { key: 'Not stated', tone: 'nd' },
] as const;
const COLUMNS = [
  { key: 'identified', x: 30, title: 'Identified in weapons', sub: 'GUR · maker HQ' },
  { key: 'brand', x: 250, title: '1. Brand', sub: 'maker HQ · 2023' },
  { key: 'made', x: 420, title: '2. Made in', sub: 'origin · 2023' },
  { key: 'sold', x: 590, title: '3. Sold to Russia by', sub: 'seller · 2023' },
  { key: 'shipped', x: 760, title: '4. Shipped by', sub: 'exporter · 2025' },
] as const;
const W = 1280,
  H = 700,
  TOP = 110,
  BH = 470,
  BW = 74;
const share = (stage: string, group: string) =>
  Number(stages.find((s) => s['stage'] === stage && s['group'] === group)?.['share_pct'] ?? 0);
const segments = (stage: string) => {
  let y = TOP;
  return GROUPS.map((g) => {
    const v = share(stage, g.key);
    const seg = { ...g, v, y, h: (v / 100) * BH };
    y += seg.h;
    return seg;
  });
};

// Map of Russia: equirectangular, longitude 27-142 E, latitude 42-70 N.
// Height for a true shape at about 56 N: 380 px for 115 degrees of longitude at cos(56) gives 5.9 px a degree.
const MAP = { lon0: 27, lon1: 142, lat0: 42, lat1: 70, x: 900, y: TOP, w: 380, h: 166 };
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

export function AtlasFigure() {
  const cols = COLUMNS.map((c) => ({ ...c, segs: segments(c.key) }));
  const [ident, brand] = cols;
  if (!ident || !brand) return null;
  return (
    <figure className="report-chart atlas">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Atlas of the supply chains of Russia's defence industry: brand, origin, seller, exporter, and Russian plants"
      >
        {/* Bands between the four linked stages. */}
        {cols.slice(1, -1).map((c, i) => {
          const n = cols[i + 2];
          if (!n) return null;
          return c.segs.map((s, j) => {
            const t = n.segs[j];
            if (!t || s.h <= 0 || t.h <= 0) return null;
            const x1 = c.x + BW,
              x2 = n.x,
              m = (x1 + x2) / 2;
            return (
              <path
                key={`${c.key}-${s.key}`}
                d={`M${x1},${s.y}C${m},${s.y} ${m},${t.y} ${x2},${t.y}V${t.y + t.h}C${m},${t.y + t.h} ${m},${s.y + s.h} ${x1},${s.y + s.h}Z`}
                className={`atlas-band ${s.tone}`}
              />
            );
          });
        })}
        {cols.map((c) => (
          <g key={c.key}>
            <text x={c.x} y={TOP - 34} className="lp-title atlas-col">
              {c.title}
            </text>
            <text x={c.x} y={TOP - 16} className="lp-axis">
              {c.sub}
            </text>
            {c.key === 'identified' && (
              <rect
                x={c.x - 6}
                y={TOP - 6}
                width={BW + 12}
                height={BH + 12}
                className="atlas-apart"
              />
            )}
            {c.segs.map((s) =>
              s.h > 0 ? (
                <g key={s.key}>
                  <rect x={c.x} y={s.y} width={BW} height={s.h} className={`atlas-seg ${s.tone}`} />
                  {s.h >= 15 && (
                    <text x={c.x + 5} y={s.y + 12} className={`atlas-pct ${s.tone}`}>
                      {Math.round(s.v)}%
                    </text>
                  )}
                </g>
              ) : null,
            )}
          </g>
        ))}
        {/* Group names, at the height of each group in the brand column. */}
        {brand.segs.map((s) =>
          s.h > 0 ? (
            <text
              key={s.key}
              x={brand.x - 8}
              y={s.y + s.h / 2 + 4}
              textAnchor="end"
              className="lp-label flow-name"
            >
              {s.key}
            </text>
          ) : null,
        )}
        <text x={ident.x} y={TOP + BH + 30} className="lp-axis">
          a selective catalogue,
        </text>
        <text x={ident.x} y={TOP + BH + 44} className="lp-axis">
          not a measure of trade
        </text>
        <text x={brand.x} y={TOP + BH + 30} className="lp-axis">
          Brand, made, sold: the same goods (Russian customs, Jan–Oct 2023).
        </text>
        <text x={brand.x} y={TOP + BH + 44} className="lp-axis">
          Shipped: CHP-list exports to Russia, 2025. Bands join shares, not shipments.
        </text>
        {/* 5. Where they go. */}
        <text x={MAP.x} y={TOP - 34} className="lp-title atlas-col">
          5. Where they go in Russia
        </text>
        <text x={MAP.x} y={TOP - 16} className="lp-axis">
          defence plants by main weapon
        </text>
        <clipPath id="atlas-map">
          <rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} />
        </clipPath>
        <path d={landPath} className="atlas-land" clipPath="url(#atlas-map)" />
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
              <text x={(x ?? 0) + 5} y={(y ?? 0) - 5} className="atlas-num">
                {i + 1}
              </text>
              <text x={MAP.x} y={MAP.y + MAP.h + 24 + i * 15} className="lp-axis atlas-place">
                {i + 1} {(p['entity'] ?? '').split(' (')[0]} ({p['city']})
              </text>
            </g>
          );
        })}
        <g transform={`translate(${MAP.x},${MAP.y + MAP.h + 130})`}>
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
              transform={`translate(${(i % 3) * 126},${Math.floor(i / 3) * 18})`}
              className="atlas-plant"
            >
              {GLYPH[k ?? ''] ? <path d={GLYPH[k ?? '']} /> : <circle r="3" />}
              <text x="10" y="4" className="lp-axis">
                {label}
              </text>
            </g>
          ))}
          <g transform="translate(0,44)" className="atlas-plant lead">
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
