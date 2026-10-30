import raw from './data/chp.csv?raw';
import chainRaw from './data/chp-chain.csv?raw';
import { readCsv } from './line-panel';

// Figure 10: exports of high-priority (CHP) goods to Russia declared by 17 partners, 2021-2025, million USD.
// Data: research/out/fnf/rapport/fD1-v2.csv (UN Comtrade mirror data, 55 HS6 codes of the CHP list).
// (a) stacked bars by supplier, China and Hong Kong in signal. (b) the supply chain of Russia's imports of
// battlefield goods, Jan-Oct 2023, from Russian customs data (KSE, doc_c5184d052910 p. 11-13): the share of
// coalition countries at each stage. KSE: these flows are not necessarily export control violations.
const rows = readCsv(raw);
const YEARS = [2021, 2022, 2023, 2024, 2025];
const v = (panel: string, series: string, year: number) => {
  const r = rows.find((x) => x['panel'] === panel && x['series'] === series && x['year'] === String(year));
  return r && r['value'] ? Number(r['value']) : undefined;
};
const SUPPLIERS = [
  { name: 'Coalition', tone: 'old' },
  { name: 'China', tone: 'new' },
  { name: 'Hong Kong', tone: 'new' },
  { name: 'Nine third countries', tone: 'other' },
] as const;
const chain = readCsv(chainRaw);
const STAGES = ['Brand (producer headquarters)', 'Country of manufacture', 'Final seller to Russia'];
const GROUPS = [
  { name: 'Coalition', tone: 'old' },
  { name: 'China, Hong Kong', tone: 'new' },
  { name: 'Other', tone: 'other' },
  { name: 'Not identified', tone: 'unknown' },
] as const;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export function ChpFigure() {
  const X0 = 50,
    BASE = 250,
    SCALE = 0.016,
    BW = 34;
  const gx = 330,
    BWID = 290;
  return (
    <figure className="report-chart">
      <svg viewBox="0 0 640 340" role="img" aria-label="Exports of high-priority goods to Russia by supplier, 2021-2025">
        <text y="12" className="lp-title">
          a. By supplier
        </text>
        <text y="30" className="lp-axis">
          million USD
        </text>
        {[0, 5000, 10000].map((t) => (
          <g key={t}>
            <line x1={X0} x2={X0 + 5 * 50} y1={BASE - t * SCALE} y2={BASE - t * SCALE} className="plot-grid" />
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
          const china = (parts[1]!.value + parts[2]!.value) / total;
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
          <g key={s.name} transform={`translate(${X0 + 2 * 50 * (i % 2)},${BASE + 34 + Math.floor(i / 2) * 16})`}>
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
        <text x={gx} y="12" className="lp-title">
          b. Who makes and who sells, 2023
        </text>
        <text x={gx} y="30" className="lp-axis">
          Russian imports of CHP battlefield goods, Jan–Oct 2023, %
        </text>
        {STAGES.map((stage, r) => {
          let x = gx;
          const y = 58 + r * 54;
          return (
            <g key={stage}>
              <text x={gx} y={y - 6} className="lp-label flow-name">
                {stage}
              </text>
              {GROUPS.map((g) => {
                const share = Number(chain.find((c) => c['stage'] === stage && c['group'] === g.name)?.['share_pct'] ?? 0);
                const w = (share / 100) * BWID,
                  x1 = x;
                x += w;
                return share > 0 ? (
                  <g key={g.name} className={`lp-series ${g.tone}`}>
                    <rect x={x1} y={y} width={w} height="20" className="lp-bar stack" />
                    {w > 24 && (
                      <text x={x1 + 4} y={y + 14} className="lp-label on-bar">
                        {Math.round(share)}%
                      </text>
                    )}
                  </g>
                ) : null;
              })}
            </g>
          );
        })}
        {GROUPS.map((g, i) => (
          <g key={g.name} transform={`translate(${gx + (i % 2) * 140},${226 + Math.floor(i / 2) * 16})`}>
            <g className={`lp-series ${g.tone}`}>
              <rect width="10" height="10" y="-9" className="lp-bar" />
            </g>
            <text x="14" className="lp-axis">
              {g.name}
            </text>
          </g>
        ))}
        <text x={gx} y="278" className="lp-axis">
          Top coalition brands, million USD:
        </text>
        <text x={gx} y="294" className="lp-axis">
          {chain
            .filter((c) => c['stage'] === 'brand')
            .slice(0, 2)
            .map((c) => `${c['group']} ${c['share_pct']}`)
            .join(' · ')}
        </text>
        <text x={gx} y="310" className="lp-axis">
          {chain
            .filter((c) => c['stage'] === 'brand')
            .slice(2)
            .map((c) => `${(c['group'] ?? '').replace(' (US)', '')} ${c['share_pct']}`)
            .join(' · ')}
        </text>
      </svg>
    </figure>
  );
}
