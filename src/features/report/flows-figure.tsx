import raw from './data/flows.csv?raw';
import { readCsv } from './line-panel';

// Figure 6: Russian seaborne oil in January 2026 (KSE Russian Oil Tracker, Kpler data; kb/d).
// Two separate views, never one path: no source links a fleet category to a buyer. Data: f4-v2.csv panel a.
const rows = readCsv(raw).map((r) => ({
  from: r['from'] ?? '',
  to: r['to'] ?? '',
  v: Number(r['value']),
}));
const FLEET_TONE: Record<string, string> = {
  'Shadow fleet': 'new',
  'IG-insured': 'old',
  'Coalition, no IG cover': 'other',
};
const BASINS = ['Baltic', 'Black Sea', 'Pacific', 'Arctic'];
const BUYERS = [
  'China',
  'India',
  'Turkey',
  'Singapore',
  'Brazil',
  'Other countries',
  'Unknown destination',
];

const basinNodes = BASINS.flatMap((b) => [`Crude · ${b}`, `Products · ${b}`]);

/** One horizontal stacked bar with labels inside the wide segments and below the narrow ones. */
function StackBar({
  y,
  label,
  parts,
  scale,
  share = true,
}: {
  y: number;
  label: string;
  parts: { name: string; v: number; tone: string }[];
  scale: number;
  /** Write the share of each wide segment inside it. */
  share?: boolean;
}) {
  const total = parts.reduce((t, p) => t + p.v, 0);
  // The left edge of each segment, and the end of the bar last.
  const starts = parts.reduce<number[]>(
    (at, p) => [...at, (at.at(-1) ?? 150) + p.v * scale],
    [150],
  );
  const x = starts.at(-1) ?? 150;
  return (
    <g>
      <text x="0" y={y + 15} className="lp-label flow-name">
        {label}
      </text>
      {parts.map((p, i) => {
        const w = p.v * scale,
          x1 = starts[i] ?? 150;
        const inside = w > 34;
        return (
          <g key={p.name} className={`lp-series ${p.tone}`}>
            <rect x={x1} y={y} width={w} height="22" className="lp-bar stack" />
            {inside && share && (
              <text x={x1 + 4} y={y + 15} className="lp-label on-bar">
                {Math.round((p.v / total) * 100)}%
              </text>
            )}
          </g>
        );
      })}
      <text x={x + 6} y={y + 15} className="lp-label total">
        {Math.round(total).toLocaleString('en-US')}
      </text>
    </g>
  );
}

export function FlowsFigure() {
  const fleetOf = (node: string) =>
    ['Shadow fleet', 'IG-insured', 'Coalition, no IG cover']
      .map((f) => ({
        name: f,
        v: rows.find((r) => r.from === node && r.to === f)?.v ?? 0,
        tone: FLEET_TONE[f] ?? 'other',
      }))
      .filter((p) => p.v > 0);
  return (
    <figure className="report-chart">
      <svg
        viewBox="0 0 640 530"
        role="img"
        aria-label="Russian seaborne oil, January 2026: fleet by basin, and buyers"
      >
        <text y="12" className="lp-title">
          a. Fleet category, by loading basin (kb/d)
        </text>
        <g className="lp-series new">
          <rect x="150" y="24" width="10" height="10" className="lp-bar" />
        </g>
        <text x="166" y="33" className="lp-axis">
          Shadow fleet
        </text>
        <g className="lp-series old">
          <rect x="260" y="24" width="10" height="10" className="lp-bar" />
        </g>
        <text x="276" y="33" className="lp-axis">
          IG-insured
        </text>
        {basinNodes.map((n, i) => (
          <StackBar key={n} y={48 + i * 30} label={n} parts={fleetOf(n)} scale={0.24} />
        ))}
        <g transform="translate(0,310)">
          <text y="12" className="lp-title">
            b. Buyers (kb/d)
          </text>
          <g className="lp-series old">
            <rect x="150" y="2" width="10" height="10" className="lp-bar" />
          </g>
          <text x="166" y="11" className="lp-axis">
            Crude
          </text>
          <g className="lp-series other">
            <rect x="220" y="2" width="10" height="10" className="lp-bar" />
          </g>
          <text x="236" y="11" className="lp-axis">
            Products
          </text>
          {BUYERS.map((b, i) => (
            <StackBar
              key={b}
              y={26 + i * 28}
              label={b}
              parts={['Seaborne crude', 'Seaborne products'].map((n) => ({
                name: n,
                v: rows.find((r) => r.from === n && r.to === b)?.v ?? 0,
                tone:
                  b === 'Unknown destination' ? 'new' : n === 'Seaborne crude' ? 'old' : 'other',
              }))}
              scale={0.2}
              share={false}
            />
          ))}
        </g>
      </svg>
    </figure>
  );
}
