import raw from './data/controllers.csv?raw';
import { readCsv } from './line-panel';

// Figure 13: ultimate controllers of the report's nodes, by holding and layer, 2026 (number of nodes).
// Nodes: the entities of the record designated by the EU, OFAC or the UK and linked to at least 3 others,
// and the designated fleet as one aggregate node. One band unit is one node,
// not economic size. A lead (unstored source or a link inferred from a name) is a dashed band.
const rows = readCsv(raw)
  .map((r) => ({
    layer: r['layer'] ?? '',
    controller: r['controller'] ?? '',
    holding: r['holding'] ?? '',
    lead: r['evidence'] === 'lead',
    v: Number(r['nodes']),
  }))
  .filter((r) => Number.isFinite(r.v) && r.v > 0);
const CONTROLLERS = [
  { name: 'Russian federal state', tone: 'old' },
  { name: 'Russian region or level not stated', tone: 'new' },
  { name: 'Private shareholders', tone: 'other' },
  { name: 'Foreign group or state', tone: 'other' },
  { name: 'Aggregate (no single controller)', tone: 'unknown' },
  { name: 'Not found after search', tone: 'unknown' },
] as const;
const LAYERS = ['Pay', 'Finance', 'Fight', 'Other'];
const toneOf = (c: string) => CONTROLLERS.find((x) => x.name === c)?.tone ?? 'unknown';
const holdingKey = (r: { controller: string; holding: string }) => `${r.controller}|${r.holding}`;
// Holdings in the order of their controller, the largest first; "Other holdings" last in each group.
const holdings = CONTROLLERS.flatMap((c) => {
  const keys = [...new Set(rows.filter((r) => r.controller === c.name).map(holdingKey))];
  const size = (k: string) => rows.filter((r) => holdingKey(r) === k).reduce((t, r) => t + r.v, 0);
  return keys.sort(
    (a, b) =>
      Number(a.endsWith('|Other holdings')) - Number(b.endsWith('|Other holdings')) ||
      size(b) - size(a),
  );
});

const U = 4.4, // pixels per node
  GAP = 8,
  TOP = 24,
  XC = 170, // controller column
  XH = 375, // holding column
  XL = 570, // layer column
  BAR = 6;
type Stack = Map<string, { y: number; total: number }>;
const stack = (names: string[], sizeOf: (n: string) => number, gap: number): Stack => {
  let y = TOP;
  return new Map(
    names.map((n) => {
      const total = sizeOf(n);
      const at = { y, total };
      y += total * U + gap;
      return [n, at] as const;
    }),
  );
};

export function ControllersFigure() {
  const sumBy = (f: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(f).reduce((t, r) => t + r.v, 0);
  const C = stack(
    CONTROLLERS.map((c) => c.name),
    (n) => sumBy((r) => r.controller === n),
    26,
  );
  const H = stack(holdings, (k) => sumBy((r) => holdingKey(r) === k), GAP);
  const Ly = stack(LAYERS, (l) => sumBy((r) => r.layer === l), 34);
  const used = new Map<string, number>();
  const take = (key: string, h: number) => {
    const y = used.get(key) ?? 0;
    used.set(key, y + h);
    return y;
  };
  const ribbon = (x1: number, y1: number, x2: number, y2: number, h: number) => {
    const m = (x1 + x2) / 2;
    return `M${x1},${y1}C${m},${y1} ${m},${y2} ${x2},${y2}V${y2 + h}C${m},${y2 + h} ${m},${y1 + h} ${x1},${y1 + h}Z`;
  };
  // Left ribbons: controller to holding; right ribbons: holding to layer, in layer order inside each holding.
  const left = holdings
    .flatMap((k) =>
      [false, true].map((lead) => {
        const v = sumBy((r) => holdingKey(r) === k && r.lead === lead);
        return { k, lead, v, controller: k.split('|')[0] ?? '' };
      }),
    )
    .filter((l) => l.v > 0);
  const right = holdings
    .flatMap((k) =>
      LAYERS.flatMap((layer) =>
        [false, true].map((lead) => ({
          k,
          layer,
          lead,
          v: sumBy((r) => holdingKey(r) === k && r.layer === layer && r.lead === lead),
          controller: k.split('|')[0] ?? '',
        })),
      ),
    )
    .filter((l) => l.v > 0);
  const height =
    Math.max(...[...C.values(), ...H.values(), ...Ly.values()].map((h) => h.y + h.total * U)) + 30;
  return (
    <figure className="report-chart">
      <svg
        viewBox={`0 0 640 ${height}`}
        role="img"
        aria-label="Ultimate controllers of the critical nodes, by holding and layer, 2026"
      >
        {['Ultimate controller', 'Holding', 'Layer'].map((t, i) => (
          <text key={t} x={[XC, XH, XL][i]} y="12" className="lp-axis">
            {t}
          </text>
        ))}
        {left.map((l, i) => {
          const c = C.get(l.controller),
            h = H.get(l.k);
          if (!c || !h) return null;
          const hh = l.v * U;
          return (
            <path
              key={`l${i}`}
              d={ribbon(
                XC + BAR,
                c.y + take(`c${l.controller}`, hh),
                XH,
                h.y + take(`hl${l.k}`, hh),
                hh,
              )}
              className={`lp-series ${toneOf(l.controller)} flow-ribbon ${l.lead ? 'lead' : ''}`}
            />
          );
        })}
        {right.map((l, i) => {
          const h = H.get(l.k),
            y = Ly.get(l.layer);
          if (!h || !y) return null;
          const hh = l.v * U;
          return (
            <path
              key={`r${i}`}
              d={ribbon(
                XH + BAR,
                h.y + take(`hr${l.k}`, hh),
                XL,
                y.y + take(`y${l.layer}`, hh),
                hh,
              )}
              className={`lp-series ${toneOf(l.controller)} flow-ribbon ${l.lead ? 'lead' : ''}`}
            />
          );
        })}
        {[...C].map(([n, c]) => (
          <g key={n}>
            <rect x={XC} y={c.y} width={BAR} height={c.total * U} className="flow-node" />
            <text
              x={XC - 6}
              y={c.y + (c.total * U) / 2}
              textAnchor="end"
              className="lp-label flow-name"
            >
              {n.replace(' or level not stated', '').replace(' (no single controller)', '')}
            </text>
            <text x={XC - 6} y={c.y + (c.total * U) / 2 + 13} textAnchor="end" className="lp-axis">
              {c.total} nodes
            </text>
          </g>
        ))}
        {[...H].map(([k, h]) => (
          <g key={k}>
            <rect x={XH} y={h.y} width={BAR} height={h.total * U} className="flow-node" />
            <text
              x={XH - 4}
              y={h.y + (h.total * U) / 2 + 4}
              textAnchor="end"
              className="lp-label flow-name case-on-flow"
            >
              {k.split('|')[1]} {h.total}
            </text>
          </g>
        ))}
        {[...Ly].map(([n, y]) => (
          <g key={n}>
            <rect x={XL} y={y.y} width={BAR} height={y.total * U} className="flow-node" />
            <text x={XL + BAR + 6} y={y.y + (y.total * U) / 2 + 4} className="lp-label flow-name">
              {n} {y.total}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
