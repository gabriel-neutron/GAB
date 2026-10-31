import raw from './data/buyers.csv?raw';
import { readCsv } from './line-panel';

// Figure 5: crude oil bought from Russia by the EU, China and India, 2021 and 2025 (Mt). The bars have
// almost the same length: the volume held, the buyers changed. Data: fH3-v2.csv panel b (Eurostat Comext,
// UN Comtrade); customs data, so pipeline crude is included.
const rows = readCsv(raw);
const BUYERS = [
  { name: 'EU27', tone: 'old' },
  { name: 'China', tone: 'new' },
  { name: 'India', tone: 'new' },
] as const;
const value = (series: string, year: number) => {
  const r = rows.find(
    (x) => x['panel'] === 'b' && x['series'] === series && x['period'] === String(year),
  );
  return r ? Number(r['value']) : undefined;
};
const X0 = 60,
  SCALE = 2.6; // pixels per Mt

export function CrudeBuyersFigure() {
  return (
    <figure className="report-chart">
      <svg
        viewBox="0 0 640 170"
        role="img"
        aria-label="Crude oil bought from Russia by the EU, China and India, 2021 and 2025"
      >
        <text x={X0} y="14" className="lp-axis">
          Mt
        </text>
        {[2021, 2025].map((year, row) => {
          const parts = BUYERS.map((b) => ({ ...b, v: value(b.name, year) }));
          // A missing buyer would make the total wrong: draw no total then.
          const total = parts.every((p) => p.v !== undefined)
            ? parts.reduce((t, p) => t + (p.v ?? 0), 0)
            : undefined;
          const y = 34 + row * 66;
          let x = X0;
          return (
            <g key={year}>
              <text x="0" y={y + 22} className="lp-title">
                {year}
              </text>
              {parts.map((p) => {
                if (p.v === undefined) return null;
                const w = p.v * SCALE,
                  x1 = x;
                x += w;
                const inside = w > 60;
                return (
                  <g key={p.name} className={`lp-series ${p.tone}`}>
                    <rect x={x1} y={y} width={w} height="32" className="lp-bar stack" />
                    <text
                      x={inside ? x1 + 8 : x1 + w / 2}
                      y={inside ? y + 21 : y + 48}
                      textAnchor={inside ? 'start' : 'middle'}
                      className={inside ? 'lp-label on-bar' : 'lp-label'}
                    >
                      {p.name === 'EU27' ? 'EU' : p.name} {Math.round(p.v)}
                    </text>
                  </g>
                );
              })}
              {total !== undefined && (
                <text x={x + 8} y={y + 21} className="lp-label total">
                  {total.toFixed(1)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
