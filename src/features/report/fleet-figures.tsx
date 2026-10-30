import portsRaw from './data/fleet-ports.csv?raw';
import wavesRaw from './data/fleet-waves.csv?raw';
import { readCsv } from './line-panel';

// Figures on the designated tanker fleet. Data: research/out/fnf/rapport/f7-fleet-full.csv (designations of the
// record; Global Fishing Watch port calls by IMO number), aggregated into ./data/fleet-ports.csv and
// ./data/fleet-waves.csv (author's counts of distinct tankers).
const ports = readCsv(portsRaw);
const num = (key: string) => Number(ports.find((r) => r['series'] === key)?.['value'] ?? NaN);

function Tile({ x, value, label }: { x: number; value: string; label: string }) {
  return (
    <g transform={`translate(${x},0)`}>
      {x > 0 && <line x1="-12" x2="-12" y1="4" y2="60" className="plot-grid" />}
      <text y="34" className="vessel-count">
        {value}
      </text>
      <text y="54" className="lp-axis">
        {label}
      </text>
    </g>
  );
}

/** Figure 7: where designated tankers still call after their first designation, by port country. */
export function FleetPortsFigure() {
  const countries = ports
    .filter((r) => r['series']?.startsWith('country:'))
    .map((r) => ({ name: (r['series'] ?? '').slice(8), v: Number(r['value']) }))
    .sort((a, b) => b.v - a.v);
  const euPorts = ports
    .filter((r) => r['series']?.startsWith('eu port:'))
    .slice(0, 9)
    .map((r) => `${(r['series'] ?? '').slice(8)} ${r['value']}`);
  const designated = num('designated tankers'),
    called = num('called after designation'),
    eu = countries.find((c) => c.name === 'EU or UK')?.v ?? 0;
  const X0 = 150,
    SCALE = 2.0,
    TOP = 104;
  const height = TOP + countries.length * 22 + 58;
  return (
    <figure className="report-chart">
      <svg viewBox={`0 0 640 ${height}`} role="img" aria-label="Designated tankers calling at a port after their designation, by port country">
        <Tile x={0} value={String(designated)} label="designated tankers" />
        <Tile x={214} value={String(called)} label="called at a port after" />
        <Tile x={428} value={String(eu)} label="called in the EU or the UK" />
        <text x={X0} y={TOP - 12} className="lp-axis">
          tankers calling after designation, by port country
        </text>
        {countries.map((c, i) => {
          const y = TOP + i * 22;
          return (
            <g key={c.name} className={`lp-series ${c.name === 'EU or UK' ? 'new' : 'old'}`}>
              <text x={X0 - 8} y={y + 12} textAnchor="end" className="lp-label flow-name">
                {c.name}
              </text>
              <rect x={X0} y={y} width={c.v * SCALE} height="16" className="lp-bar" />
              <text x={X0 + c.v * SCALE + 6} y={y + 12} className="lp-label">
                {c.v}
              </text>
            </g>
          );
        })}
        <text x={X0} y={height - 28} className="lp-axis">
          EU and UK ports: {euPorts.slice(0, 5).join(' · ')}
        </text>
        <text x={X0} y={height - 12} className="lp-axis">
          {euPorts.slice(5).join(' · ')}
        </text>
      </svg>
    </figure>
  );
}

const waves = readCsv(wavesRaw);
const REGIMES = [
  { key: 'EU', tone: 'old' },
  { key: 'UK', tone: 'other' },
  { key: 'OFAC', tone: 'new' },
] as const;
const QUARTERS = Array.from({ length: 20 }, (_, i) => `${2022 + Math.floor(i / 4)}-Q${(i % 4) + 1}`);

const VENN = [
  { key: 'EU', tone: 'old', cx: 230, cy: 150, r: 100, lx: 120, ly: 60, anchor: 'start' },
  { key: 'UK', tone: 'other', cx: 360, cy: 150, r: 98, lx: 470, ly: 60, anchor: 'end' },
  { key: 'OFAC', tone: 'new', cx: 295, cy: 235, r: 60, lx: 365, ly: 300, anchor: 'start' },
] as const;
// Label points, each inside its own region of the three circles above.
const REGIONS = [
  { key: 'EU', x: 165, y: 135 },
  { key: 'UK', x: 425, y: 135 },
  { key: 'EU+UK', x: 295, y: 115 },
  { key: 'EU+OFAC+UK', x: 295, y: 196 },
  { key: 'EU+OFAC', x: 252, y: 244 },
  { key: 'OFAC+UK', x: 338, y: 244 },
  { key: 'OFAC', x: 295, y: 282 },
];

/** Figure 8: tankers newly listed by each regime per quarter, and the regimes that list each tanker. */
export function FleetWavesFigure() {
  const count = (q: string, r: string) =>
    Number(waves.find((w) => w['kind'] === 'quarter' && w['key'] === q && w['regime'] === r)?.['value'] ?? 0);
  const earlier = waves
    .filter((w) => w['kind'] === 'quarter' && (w['key'] ?? '') < (QUARTERS[0] ?? ''))
    .reduce((t, w) => t + Number(w['value']), 0);
  const combos = waves.filter((w) => w['kind'] === 'combo').map((w) => ({ key: w['key'] ?? '', v: Number(w['value']) }));
  const lag = waves.find((w) => w['kind'] === 'lag')?.['value'];
  const combo = (key: string) => combos.find((c) => c.key === key)?.v ?? 0;
  const regimeTotal = (regime: string) =>
    combos.filter((c) => c.key.split('+').includes(regime)).reduce((t, c) => t + c.v, 0);
  const X0 = 40,
    W = 590,
    BW = W / QUARTERS.length - 6,
    BASE = 250,
    SCALE = 0.55;
  return (
    <figure className="report-chart">
      <svg viewBox="0 0 640 640" role="img" aria-label="Tankers listed per quarter by the EU, the UK and OFAC, and the regimes that list each tanker">
        <text y="12" className="lp-title">
          a. New listings, by quarter (a tanker listed by two regimes counts twice)
        </text>
        {REGIMES.map((r, i) => (
          <g key={r.key} transform={`translate(${X0 + i * 70},26)`}>
            <g className={`lp-series ${r.tone}`}>
              <rect width="10" height="10" className="lp-bar" />
            </g>
            <text x="16" y="9" className="lp-axis">
              {r.key}
            </text>
          </g>
        ))}
        {[0, 100, 200, 300].map((t) => (
          <g key={t}>
            <line x1={X0} x2={X0 + W} y1={BASE - t * SCALE} y2={BASE - t * SCALE} className="plot-grid" />
            <text x={X0 - 6} y={BASE - t * SCALE + 4} textAnchor="end" className="lp-axis">
              {t}
            </text>
          </g>
        ))}
        {QUARTERS.map((q, i) => {
          let y = BASE;
          const x = X0 + i * (W / QUARTERS.length) + 3;
          return (
            <g key={q}>
              {REGIMES.map((r) => {
                const h = count(q, r.key) * SCALE;
                y -= h;
                return h > 0 ? (
                  <g key={r.key} className={`lp-series ${r.tone}`}>
                    <rect x={x} y={y} width={BW} height={h} className="lp-bar stack" />
                  </g>
                ) : null;
              })}
              {q.endsWith('Q1') && (
                <text x={x} y={BASE + 16} className="lp-axis">
                  {q.slice(0, 4)}
                </text>
              )}
            </g>
          );
        })}
        <text x={X0} y={BASE + 34} className="lp-axis">
          {earlier} tankers listed before 2022 (OFAC) are not drawn.
        </text>
        <g transform="translate(0,300)">
          <text y="12" className="lp-title">
            b. Regimes that list each tanker
          </text>
          {/* Circle areas follow each regime's total; the overlaps are not to scale. */}
          {VENN.map((c) => (
            <g key={c.key} className={`lp-series ${c.tone}`}>
              <circle cx={c.cx} cy={c.cy} r={c.r} className="venn-circle" />
              <text x={c.lx} y={c.ly} textAnchor={c.anchor} className="lp-label venn-name">
                {c.key} {regimeTotal(c.key)}
              </text>
            </g>
          ))}
          {REGIONS.map((r) => (
            <text key={r.key} x={r.x} y={r.y} textAnchor="middle" className={r.key === 'EU+OFAC+UK' ? 'venn-count core' : 'venn-count'}>
              {combo(r.key)}
            </text>
          ))}
          <text x="0" y="330" className="lp-axis">
            median lag, first to second regime: {lag} days
          </text>
        </g>
      </svg>
    </figure>
  );
}
