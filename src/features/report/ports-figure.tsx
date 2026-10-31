import raw from './data/ports.csv?raw';
import { LinePanel, PANEL_HEIGHT, readCsv, type Series } from './line-panel';

// Figure 5: all-cargo throughput of the four oil ports (a, index 2021 = 100) and the change of
// January-April 2026 against January-April 2025 (b). Data: research/out/fnf/rapport/f5-v2.csv (ASOP, NMTP).
// Colour: the Baltic ports in signal, the Black Sea ports in foreground, the all-port totals in grey.
const rows = readCsv(raw);
const years = Array.from({ length: 12 }, (_, i) => 2014 + i);
const PORTS = [
  { name: 'Primorsk', sea: 'new' },
  { name: 'Ust-Luga', sea: 'new' },
  { name: 'Novorossiysk (incl. CPC)', sea: 'old', short: 'Novorossiysk' },
  { name: 'Tuapse', sea: 'old' },
] as const;
const index = (name: string, year: number) => {
  const r = rows.find((x) => x['series'] === `${name} (index)` && x['period'] === String(year));
  return r ? Number(r['value']) : undefined;
};
const panelA: Series[] = PORTS.map((p) => {
  const points = years.map((y) => index(p.name, y));
  const label = 'short' in p ? p.short : p.name;
  return { label, tone: p.sea, points, end: `${label} ${Math.round(points.at(-1) ?? 0)}` };
});
const changes = rows
  .filter((x) => x['panel'] === 'b')
  .map((x) => ({ name: x['series'] ?? '', v: Number(x['value']) }));

const BX = 400,
  ZERO = BX + 132,
  SCALE = 5; // pixels per percentage point

export function PortsFigure() {
  return (
    <figure className="report-chart">
      <svg
        viewBox={`0 0 640 ${PANEL_HEIGHT}`}
        role="img"
        aria-label="Throughput of the four Russian oil ports, 2014-2025, and change January-April 2026"
      >
        <LinePanel
          x0={0}
          width={370}
          title="a. Throughput, all cargo"
          unit="index 2021 = 100"
          years={years}
          min={60}
          max={140}
          ticks={[60, 80, 100, 120, 140]}
          series={panelA}
          events={[
            { at: 2022.92, label: 'EU embargo' },
            { at: 2025.15, label: 'EU port ban' },
          ]}
          tickEvery={4}
          right={112}
        />
        <g>
          <text x={BX} y="12" className="lp-title">
            b. Jan–Apr 2026 against Jan–Apr 2025
          </text>
          <text x={BX} y="34" className="lp-axis">
            % change
          </text>
          <line x1={ZERO} x2={ZERO} y1="46" y2={46 + changes.length * 36} className="plot-grid" />
          {changes.map((c, i) => {
            const port = PORTS.find((p) => p.name === c.name);
            const tone = port ? port.sea : 'other';
            const y = 62 + i * 36;
            const w = Math.abs(c.v) * SCALE;
            return (
              <g key={c.name} className={`lp-series ${tone}`}>
                <text x={BX} y={y - 6} className="lp-axis">
                  {port && 'short' in port ? port.short : c.name}
                </text>
                <rect
                  x={c.v < 0 ? ZERO - w : ZERO}
                  y={y}
                  width={w}
                  height="10"
                  className="lp-bar"
                />
                <text
                  x={c.v < 0 ? ZERO - w - 4 : ZERO + w + 4}
                  y={y + 9}
                  textAnchor={c.v < 0 ? 'end' : 'start'}
                  className="lp-label"
                >
                  {c.v > 0 ? '+' : ''}
                  {c.v.toFixed(1)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </figure>
  );
}
