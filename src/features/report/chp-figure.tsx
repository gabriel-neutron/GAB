import raw from './data/chp.csv?raw';
import { readCsv } from './line-panel';
import { fightUi } from './content';

// Figure 11: exports of high-priority (CHP) goods to Russia declared by 17 partners, 2021-2025, million USD.
// (a) stacked bars by reporting country, China and Hong Kong in signal. (b) the nine third countries,
// one small chart each on one scale, in the order of the web figure. The words are those of the web figure.
const copy = fightUi.suppliers;
const rows = readCsv(raw);
const YEARS = [2021, 2022, 2023, 2024, 2025];
const v = (panel: string, series: string, year: number) => {
  const r = rows.find(
    (x) => x['panel'] === panel && x['series'] === series && x['year'] === String(year),
  );
  return r?.['value'] ? Number(r['value']) : undefined;
};
const SUPPLIERS = [
  { name: 'Coalition', tone: 'old' },
  { name: 'China', tone: 'new' },
  { name: 'Hong Kong', tone: 'new' },
  { name: 'Nine third countries', tone: 'other' },
] as const;
const COUNTRIES = [
  ...new Set(rows.filter((x) => x['panel'] === 'b').map((x) => x['series'] ?? '')),
];
// The web order: the largest change from 2023 to 2025 first; a country with no 2025 value last.
const change = (c: string) => {
  const from = v('b', c, 2023),
    to = v('b', c, 2025);
  return from === undefined || to === undefined || from === 0 ? -Infinity : to / from;
};
const THIRD = COUNTRIES.sort((a, b) => change(b) - change(a));
const MAX_B = Math.max(...THIRD.flatMap((c) => YEARS.map((y) => v('b', c, y) ?? 0)));
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export function ChpFigure() {
  const X0 = 50,
    BASE = 250,
    SCALE = 0.016,
    BW = 34;
  // Panel b: three rows of three small charts under panel a.
  const BY = 350,
    CW = 213,
    CH = 104,
    COL = 39,
    BH = 48;
  return (
    <figure className="report-chart">
      <svg
        viewBox={`0 0 640 ${BY + 56 + 3 * CH}`}
        role="img"
        aria-label="Exports of high-priority goods to Russia by reporting country, and by nine third countries, 2021-2025"
      >
        <text y="12" className="lp-title">
          {copy.a}
        </text>
        <text y="30" className="lp-axis">
          million USD
        </text>
        {[0, 5000, 10000].map((t) => (
          <g key={t}>
            <line
              x1={X0}
              x2={X0 + 5 * 50}
              y1={BASE - t * SCALE}
              y2={BASE - t * SCALE}
              className="plot-grid"
            />
            <text x={X0 - 6} y={BASE - t * SCALE + 4} textAnchor="end" className="lp-axis">
              {fmt(t)}
            </text>
          </g>
        ))}
        {YEARS.map((year, i) => {
          let y = BASE;
          const x = X0 + 8 + i * 50;
          const parts = SUPPLIERS.map((s) => ({ ...s, value: v('a', s.name, year) ?? 0 }));
          const total = parts.reduce((t, p) => t + p.value, 0);
          const china = ((parts[1]?.value ?? 0) + (parts[2]?.value ?? 0)) / total;
          return (
            <g key={year}>
              {parts.map((p) => {
                const h = p.value * SCALE;
                y -= h;
                return (
                  <g key={p.name} className={`lp-series ${p.tone}`}>
                    <rect x={x} y={y} width={BW} height={h} className="lp-bar stack" />
                  </g>
                );
              })}
              <text x={x + BW / 2} y={y - 6} textAnchor="middle" className="lp-label lp-series new">
                {Math.round(china * 100)}%
              </text>
              <text x={x + BW / 2} y={BASE + 16} textAnchor="middle" className="lp-axis">
                {year}
              </text>
            </g>
          );
        })}
        {SUPPLIERS.map((s, i) => (
          <g
            key={s.name}
            transform={`translate(${X0 + 2 * 50 * (i % 2)},${BASE + 34 + Math.floor(i / 2) * 16})`}
          >
            <g className={`lp-series ${s.tone}`}>
              <rect width="10" height="10" y="-9" className="lp-bar" />
            </g>
            <text x="14" className="lp-axis">
              {s.name}
            </text>
          </g>
        ))}
        <text x={X0} y={BASE + 70} className="lp-axis lp-series new">
          % = China and Hong Kong share
        </text>
        <g transform={`translate(0,${BY})`}>
          <text y="12" className="lp-title">
            {copy.b}
          </text>
          <text y="30" className="lp-axis">
            million USD · {copy.bScale.replace('{max}', String(MAX_B))}
          </text>
          <text y="46" className="lp-axis">
            {copy.noValueShort}: no declared value
          </text>
          {THIRD.map((c, k) => {
            const cx = (k % 3) * CW,
              cy = 64 + Math.floor(k / 3) * CH,
              base = cy + 22 + BH;
            return (
              <g key={c}>
                <text x={cx} y={cy + 10} className="lp-label flow-name">
                  {copy.countries[c] ?? c}
                </text>
                <line x1={cx} x2={cx + 5 * COL} y1={base} y2={base} className="plot-grid" />
                {YEARS.map((year, i) => {
                  const value = v('b', c, year),
                    mid = cx + i * COL + COL / 2,
                    h = ((value ?? 0) / MAX_B) * BH;
                  return (
                    <g key={year}>
                      {value !== undefined && (
                        <g className="lp-series old">
                          <rect x={mid - 3} y={base - h} width="6" height={h} className="lp-bar" />
                        </g>
                      )}
                      <text x={mid} y={base - h - 4} textAnchor="middle" className="lp-axis">
                        {value === undefined ? copy.noValueShort : value.toFixed(1)}
                      </text>
                      <text x={mid} y={base + 13} textAnchor="middle" className="lp-axis">
                        {year}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>
    </figure>
  );
}
