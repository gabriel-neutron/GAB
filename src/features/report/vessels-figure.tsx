import raw from './data/vessels.csv?raw';
import { readCsv } from './line-panel';

// Figure 7: what designated tankers do after their designation. Data: research/out/fnf/rapport/f6-v3-fleet.csv
// (Global Fishing Watch port visits and identities by IMO number; designation dates from the record).
// Top: three counts for the sample of 43 vessels. Below: 11 chosen vessels on one time axis, aligned on the
// designation date. Port calls after designation are the one highlight; identity bars are leads (pale).
const rows = readCsv(raw);
const DATA_END = Date.UTC(2026, 9, 26);
const DAY = 86_400_000;
const PRE = 180,
  POST = 730;
const L = 170,
  R = 630;
const x = (days: number) => L + ((Math.max(-PRE, Math.min(POST, days)) + PRE) / (PRE + POST)) * (R - L);
const time = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

const vessels = [...new Set(rows.filter((r) => r['row'] === 'designation').map((r) => r['vessel'] ?? ''))];
const counts = ['any call after designation', 'calls at or after +6 months', 'calls at or after +12 months'].map(
  (k) => rows.find((r) => r['row'] === 'summary' && r['vessel'] === k)?.['item'] ?? '',
);
const TILE_LABELS = ['called at a port after', 'still calling at +6 months', 'still calling at +12 months'];

export function VesselsFigure() {
  let y = 112;
  let lastGroup = '';
  const lanes = [];
  for (const name of vessels) {
    const own = rows.filter((r) => r['vessel'] === name);
    const group = own[0]?.['group'] ?? '';
    if (group !== lastGroup) y += 26;
    const head = group !== lastGroup ? { group, y: y - 12 } : undefined;
    lastGroup = group;
    lanes.push({ name, own, y, head, d0: time(own.find((r) => r['row'] === 'designation')?.['date'] ?? '') });
    y += 20;
  }
  const height = y + 30;
  return (
    <figure className="report-chart">
      <svg viewBox={`0 0 640 ${height}`} role="img" aria-label="Port calls and identities of designated tankers around their designation date">
        {counts.map((c, i) => (
          <g key={i} transform={`translate(${i * 214},0)`}>
            {i > 0 && <line x1="-12" x2="-12" y1="4" y2="60" className="plot-grid" />}
            <text y="34" className="vessel-count">
              {c}
            </text>
            <text y="54" className="lp-axis">
              {TILE_LABELS[i]}
            </text>
          </g>
        ))}
        {[
          [0, 'Designation'],
          [182, '+6 months'],
          [365, '+12 months'],
        ].map(([d, label]) => (
          <g key={label}>
            <line
              x1={x(Number(d))}
              x2={x(Number(d))}
              y1="96"
              y2={height - 24}
              className={d === 0 ? 'vessel-zero' : 'event-rule'}
            />
            <text x={x(Number(d))} y="90" textAnchor="middle" className="lp-axis">
              {label}
            </text>
          </g>
        ))}
        {[-6, 0, 6, 12, 18, 24].map((m) => (
          <text key={m} x={x(m * 30.4)} y={height - 8} textAnchor="middle" className="lp-axis">
            {m > 0 ? `+${m}` : m}
          </text>
        ))}
        <text x={R} y={height - 20} textAnchor="end" className="lp-axis">
          months
        </text>
        {lanes.map(({ name, own, y: ly, head, d0 }) => {
          const days = (iso: string) => (time(iso) - d0) / DAY;
          const end = (DATA_END - d0) / DAY;
          return (
            <g key={name}>
              {head && (
                <text x="0" y={head.y} className="lp-title vessel-group">
                  {head.group}
                </text>
              )}
              <text x={L - 8} y={ly + 4} textAnchor="end" className="lp-label flow-name">
                {name}
              </text>
              {end < POST && <rect x={x(end)} y={ly - 7} width={R - x(end)} height="14" className="vessel-unread" />}
              {own
                .filter((r) => r['row'] === 'gfw identity')
                .map((r, i) => {
                  const a = days(r['date'] ?? ''),
                    b = r['end'] ? days(r['end']) : end;
                  if (b < -PRE || a > POST) return null;
                  return <rect key={i} x={x(a)} y={ly - 3} width={Math.max(1, x(b) - x(a))} height="6" className="vessel-identity" />;
                })}
              {own
                .filter((r) => r['row'] === 'port call')
                .map((r, i) => {
                  const d = days(r['date'] ?? '');
                  if (d < -PRE || d > POST) return null;
                  return (
                    <line
                      key={i}
                      x1={x(d)}
                      x2={x(d)}
                      y1={ly - 7}
                      y2={ly + 7}
                      className={d >= 0 ? 'vessel-call after' : 'vessel-call'}
                    />
                  );
                })}
              {own
                .filter((r) => r['row'] === 'flag change')
                .map((r, i) => {
                  const d = days(r['date'] ?? '');
                  if (d < -PRE || d > POST) return null;
                  return (
                    <g key={i}>
                      <path d={`M${x(d) - 4},${ly - 11}h8l-4,5z`} className="vessel-flag" />
                      <text x={x(d) + 6} y={ly - 9} className="vessel-flag-text">
                        {(r['item'] ?? '').replace(' to ', '→')}
                      </text>
                    </g>
                  );
                })}
              {!own.some((r) => r['row'] === 'port call') && (
                <text x={x(0) + 6} y={ly + 4} className="lp-axis">
                  no port call in the period
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
