import stagesRaw from './data/atlas-stages.csv?raw';
import { readCsv } from './line-panel';

// The supply-chain atlas: brand → made → sold → shipped. The Russian plants are a separate figure.
// Each column is 100 % of one stage, with the same country groups in the same order; a band joins the share
// of one group from a stage to the next (a share, not a flow of the same goods). A group that a source does
// not state is absent from its column, not a zero. Brand, made and sold: the same goods (Russian customs,
// 2023); shipped: mirror exports of the CHP list (2025). The catalogue of identified components stands apart:
// it is a selective catalogue by maker headquarters, not a measure of trade. The source of each value is in
// the data files.
const stages = readCsv(stagesRaw);
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
const W = 880,
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

export function AtlasFigure() {
  const cols = COLUMNS.map((c) => ({ ...c, segs: segments(c.key) }));
  const [ident, brand] = cols;
  if (!ident || !brand) return null;
  return (
    <figure className="report-chart atlas">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Atlas of the supply chains of Russia's defence industry: brand, origin, seller and exporter"
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
      </svg>
    </figure>
  );
}
