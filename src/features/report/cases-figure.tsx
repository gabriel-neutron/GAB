import raw from './data/cases.csv?raw';
import { readCsv } from './line-panel';

// Figure 11: six supply chains from a foreign component to a Russian weapon, one row per chain, one column
// per hop. Data: research/out/fnf/rapport/f11-cases.csv (corrected 2026-10-30), with the listing regimes of
// f11-cases.md. A solid cell is documented, a dashed cell is a lead, an empty cell names no entity.
// A part found in a weapon does not prove that its maker sold it to Russia.
const rows = readCsv(raw);
const CHAINS = [
  'Garpiya',
  'Orlan-10',
  'KAB servomotors',
  'SN-99 navigation',
  'Electrocom',
  'Geran-2 guidance',
];
const STEPS = ['Component maker', 'Intermediary', 'Russian buyer', 'Weapon'];
const SOURCE: Record<string, string> = {
  official: 'OFFICIAL',
  research: 'RESEARCH',
  press: 'PRESS',
  'ukrainian-government-only': 'UA GOV ONLY',
};
// Short names for print, as the sources write them without the legal form. A name not in the list prints as is.
const SHORT: Record<string, string> = {
  'Xiamen Limbach Aircraft Engine Co., Ltd.': 'Xiamen Limbach',
  'Redlepus Vector Industry Shenzhen Co Ltd': 'Redlepus Vector',
  'GANZHOU GUANGWEI INTERNATIONAL TRADE CO LTD': 'Ganzhou Guangwei',
  'TSK Vektor OOO': 'TSK Vektor',
  'APEKSGRUP LIMITED LIABILITY COMPANY': 'Apeksgrup',
  'Ace Electronic (HK) Co., Limited': 'Ace Electronic (HK)',
  'Guangzhou Ausay Technology Co., Limited': 'Guangzhou Ausay',
  'STC (Специальный технологический центр)': 'STC',
  'SHENZHEN UNISON BIO TECH CO LTD': 'Shenzhen Unison',
  'SHENZHEN BIOSEN BIO TECH CO LTD': 'Shenzhen Biosen',
  OMNITRADE: 'Omnitrade',
  'SV POLIMER': 'SV Polimer',
  'Linear Technology Corporation': 'Linear Technology',
  'NVS Technologies AG': 'NVS Technologies',
  'AO KB NAVIS': 'KB Navis',
  'Astrafteros Technokosmos LTD': 'Astrafteros',
  'Ultra Trade Service LLC': 'Ultra Trade Service',
  'LLC Electrocom VPK': 'Electrocom VPK',
};
const short = (name: string) => SHORT[name] ?? name;

const LX = 100,
  CW = 131,
  RH = 76,
  TOP = 40;

export function CasesFigure() {
  return (
    <figure className="report-chart">
      <svg
        viewBox={`0 0 640 ${TOP + CHAINS.length * RH + 40}`}
        role="img"
        aria-label="Six supply chains from foreign components to Russian weapons, with the evidence of each hop"
      >
        {STEPS.map((s, i) => (
          <text key={s} x={LX + i * (CW + 4)} y="14" className="lp-axis">
            {s}
          </text>
        ))}
        {CHAINS.map((chain, r) => {
          const y = TOP + r * RH;
          return (
            <g key={chain}>
              {chain.split(' ').map((word, i) => (
                <text key={i} x="0" y={y + 16 + i * 15} className="lp-title case-chain">
                  {word}
                </text>
              ))}
              {STEPS.map((_, c) => {
                const cells = rows.filter(
                  (x) => x['chain'] === chain && x['step_order'] === String(c + 1),
                );
                const best = cells.some((x) => x['evidence'] === 'documented')
                  ? 'documented'
                  : cells.some((x) => x['evidence'] === 'lead')
                    ? 'lead'
                    : 'none';
                const named = cells.filter((x) => x['entity']);
                const head = cells.find((x) => x['evidence'] === best) ?? cells[0];
                const x0 = LX + c * (CW + 4);
                const listed = [
                  ...new Set(named.flatMap((x) => (x['listed'] ? x['listed'].split(' ') : []))),
                ];
                return (
                  <g key={c}>
                    <rect
                      x={x0}
                      y={y}
                      width={CW}
                      height={RH - 10}
                      className={`case-cell ${best}`}
                    />
                    {c > 0 && <path d={`M${x0 - 4},${y + 33}l3,-3v6z`} className="method-head" />}
                    {named.length === 0 ? (
                      <text x={x0 + 6} y={y + 18} className="lp-axis">
                        not named
                      </text>
                    ) : (
                      named.slice(0, 2).map((x, i) => (
                        <text key={i} x={x0 + 6} y={y + 17 + i * 14} className="case-name">
                          {short(x['entity'] ?? '')}
                        </text>
                      ))
                    )}
                    {named.length > 2 && (
                      <text x={x0 + 6} y={y + 45} className="lp-axis">
                        +{named.length - 2} more
                      </text>
                    )}
                    {head && (
                      <text
                        x={x0 + 6}
                        y={y + RH - 16}
                        className={`case-source ${head['source_type'] === 'ukrainian-government-only' ? 'ua' : ''}`}
                      >
                        {SOURCE[head['source_type'] ?? ''] ?? ''} {head['source_year']}
                      </text>
                    )}
                    {listed.length > 0 && (
                      <text
                        x={x0 + CW - 6}
                        y={y + RH - 16}
                        textAnchor="end"
                        className="case-listed"
                      >
                        {listed.join(' ')}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        <g transform={`translate(0,${TOP + CHAINS.length * RH + 14})`}>
          <rect width="14" height="10" y="-9" className="case-cell documented" />
          <text x="20" className="lp-axis">
            documented
          </text>
          <rect x="110" width="14" height="10" y="-9" className="case-cell lead" />
          <text x="130" className="lp-axis">
            lead
          </text>
          <text x="190" className="lp-axis">
            <tspan className="case-listed">US EU UK</tspan> listed by ·{' '}
            <tspan className="case-listed">BIS</tspan> US export denial order
          </text>
        </g>
      </svg>
    </figure>
  );
}
