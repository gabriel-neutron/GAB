import raw from './data/ports-alt.csv?raw';
import { LinePanel, PANEL_HEIGHT, readCsv, type Series } from './line-panel';

// Three before/after versions of figure 5, for the operator to choose. Data: research/out/fnf/rapport
// f5-asop.csv, f5-terminals.csv and f5-pipelines-eu.csv (ASOP, Bruegel, Eurostat), copied to ports-alt.csv.
const rows = readCsv(raw);
const get = (panel: string, series: string, period: string) => {
  const r = rows.find((x) => x['panel'] === panel && x['series'] === series && x['period'] === period);
  return r ? Number(r['value']) : undefined;
};

interface Pair { label: string; before: number; after: number }
/** A before/after dot plot: the 2021 value hollow, the 2025 value filled, the change at the right. */
function Dumbbell({ y0, title, unit, pairs, max }: { y0: number; title: string; unit: string; pairs: Pair[]; max: number }) {
  const X0 = 150,
    X1 = 560;
  const x = (v: number) => X0 + (v / max) * (X1 - X0);
  const ticks = [0, max / 2, max];
  return (
    <g transform={`translate(0,${y0})`}>
      <text y="12" className="lp-title">
        {title}
      </text>
      <text x={X0} y="32" className="lp-axis">
        {unit}
      </text>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1="40" y2={40 + pairs.length * 24} className="plot-grid" />
          <text x={x(t)} y={56 + pairs.length * 24} textAnchor="middle" className="lp-axis">
            {t}
          </text>
        </g>
      ))}
      {pairs.map((p, i) => {
        const y = 54 + i * 24;
        const up = p.after >= p.before;
        const change = Math.round(((p.after - p.before) / p.before) * 100);
        return (
          <g key={p.label} className={`lp-series ${up ? 'new' : 'old'}`}>
            <text x="0" y={y + 4} className="lp-label dumbbell-name">
              {p.label}
            </text>
            <line x1={x(p.before)} x2={x(p.after)} y1={y} y2={y} className="lp-line" />
            <circle cx={x(p.before)} cy={y} r="4" className="lp-dot hollow" />
            <circle cx={x(p.after)} cy={y} r="4" className="lp-dot" />
            <text x={X1 + 64} y={y + 4} textAnchor="end" className="lp-label">
              {change > 0 ? '+' : ''}
              {change}%
            </text>
          </g>
        );
      })}
    </g>
  );
}
function Key({ y }: { y: number }) {
  return (
    <g transform={`translate(150,${y})`} className="lp-series other">
      <circle cx="4" cy="-4" r="4" className="lp-dot hollow" />
      <text x="14" className="lp-axis">
        2021
      </text>
      <circle cx="64" cy="-4" r="4" className="lp-dot" />
      <text x="74" className="lp-axis">
        2025
      </text>
      <text x="124" className="lp-axis">
        orange: rise · black: fall
      </text>
    </g>
  );
}

const PORTS = ['Novorossiysk', 'Ust-Luga', 'Kozmino', 'Primorsk', 'Murmansk', 'Taman', 'Tuapse', 'Vysotsk'];
export function PortsBeforeAfter() {
  const pairs = PORTS.flatMap((p) => {
    const before = get('port', p, '2021'),
      after = get('port', p, '2025');
    return before !== undefined && after !== undefined ? [{ label: p, before, after }] : [];
  });
  return (
    <figure className="report-chart">
      <svg viewBox="0 0 640 290" role="img" aria-label="Throughput of eight Russian oil ports, 2021 and 2025">
        <Key y={14} />
        <Dumbbell y0={20} title="" unit="Mt, all cargo" pairs={pairs} max={180} />
      </svg>
    </figure>
  );
}

const years = Array.from({ length: 12 }, (_, i) => 2014 + i);
export function CrudeAndProducts() {
  const series: Series[] = [
    { label: 'Crude oil', tone: 'new', points: years.map((y) => get('oil', 'Crude oil', String(y))) },
    { label: 'Oil products', tone: 'old', points: years.map((y) => get('oil', 'Oil products', String(y))) },
  ];
  return (
    <figure className="report-chart">
      <svg viewBox={`0 0 640 ${PANEL_HEIGHT}`} role="img" aria-label="Crude oil and oil products through Russian ports, 2014-2025">
        <LinePanel
          x0={0}
          width={640}
          title=""
          unit="Mt, all Russian ports"
          years={years}
          max={350}
          ticks={[0, 100, 200, 300]}
          series={series}
          events={[
            { at: 2022.15, label: 'Invasion' },
            { at: 2022.92, label: 'EU embargoes' },
          ]}
          tickEvery={1}
          right={130}
        />
      </svg>
    </figure>
  );
}

const bcm = (v: number | undefined) => (v === undefined ? undefined : v / 1000);
export function EuImportsBeforeAfter() {
  const oil: Pair[] = [
    ['Crude oil', 'UE27 : pétrole brut importé de Russie (O4100_TOT)'],
    ['Oil products', 'UE27 : produits pétroliers importés de Russie (O4600)'],
  ].flatMap(([label = '', s = '']) => {
    const before = bcm(get('gas', s, '2021')),
      after = bcm(get('gas', s, '2025'));
    return before !== undefined && after !== undefined ? [{ label, before, after }] : [];
  });
  const gas: Pair[] = [
    ['Ukraine transit', "Transit par l'Ukraine"],
    ['TurkStream', "TurkStream (vers l'UE)"],
    ['LNG', 'UE27 : GNL importé de Russie (G3200)'],
  ].flatMap(([label = '', s = '']) => {
    const before = bcm(get('gas', s, '2021')),
      after = bcm(get('gas', s, '2025'));
    return before !== undefined && after !== undefined ? [{ label, before, after }] : [];
  });
  return (
    <figure className="report-chart">
      <svg viewBox="0 0 640 300" role="img" aria-label="EU imports from Russia, 2021 and 2025">
        <Key y={14} />
        <Dumbbell y0={20} title="Oil" unit="Mt" pairs={oil} max={120} />
        <Dumbbell y0={150} title="Gas" unit="bcm" pairs={gas} max={50} />
      </svg>
    </figure>
  );
}
