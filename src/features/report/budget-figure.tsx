import raw from './data/budget.csv?raw';
import { LinePanel, PANEL_HEIGHT, readCsv, type Series } from './line-panel';

// Figure 4: oil and gas revenue of the Russian federal budget. Data: research/out/fnf/rapport/fH4-v2.csv.
// (a) share of federal revenue, full years and the January-September pair; (b) oil and gas revenue and
// national defence, in trillion roubles of 2021. Defence: executed to 2021 (Minfin), reported for 2022;
// Minfin publishes no outturn by section since 2022, so 2023-2024 are SIPRI estimates and 2025 the
// amended law (hollow, dashed). Sources: research/out/fnf/rapport/fH4-defence-sources.md.
const rows = readCsv(raw);
const value = (series: string, period: string) => {
  const r = rows.find((x) => x['series'] === series && x['period'] === period);
  return r ? { v: Number(r['value']), style: r['style'] ?? '' } : undefined;
};
const years = Array.from({ length: 13 }, (_, i) => 2014 + i);
const share = years.map((y) => value('Oil and gas share of federal revenue', String(y))?.v);
const janSep = years.map(
  (y) => value('Oil and gas share, January-September', `${y}-01/${y}-09`)?.v,
);
const yearsB = years.slice(0, 12);
const revenue = yearsB.map((y) => value('Oil and gas revenue', String(y)));
const defence = yearsB.map((y) => value('National defence', String(y)));
const ESTIMATED = new Set(['estimate', 'plan']);

const panelA: Series[] = [
  { label: 'Full year', tone: 'old', points: share },
  {
    label: 'January–September',
    tone: 'new',
    points: janSep,
    hollow: janSep.map(() => true),
    dashed: true,
    end: `Jan–Sep ${janSep.at(-1)?.toFixed(1)}`,
  },
];
const panelB: Series[] = [
  {
    label: 'Oil and gas revenue',
    tone: 'old',
    points: revenue.map((r) => r && r.v / 1000),
    end: 'Oil and gas',
  },
  {
    label: 'National defence',
    tone: 'new',
    points: defence.map((r) => (r && !ESTIMATED.has(r.style) ? r.v / 1000 : undefined)),
    end: '',
  },
  {
    // Starts at the last reported year so the line has no gap; hollow marks are estimates or plans.
    label: 'Defence estimate',
    tone: 'new',
    points: defence.map((r, i) =>
      r && (ESTIMATED.has(r.style) || ESTIMATED.has(defence[i + 1]?.style ?? ''))
        ? r.v / 1000
        : undefined,
    ),
    hollow: defence.map((r) => ESTIMATED.has(r?.style ?? '')),
    dashed: true,
    end: 'Defence',
  },
];
const invasion = { at: 2022.15, label: 'Invasion' };

export function BudgetFigure() {
  return (
    <figure className="report-chart">
      <svg
        viewBox={`0 0 640 ${PANEL_HEIGHT}`}
        role="img"
        aria-label="Oil and gas revenue of the Russian federal budget, 2014-2026"
      >
        <LinePanel
          x0={0}
          width={300}
          title="a. Share of federal revenue"
          unit="%"
          years={years}
          max={60}
          ticks={[0, 20, 40, 60]}
          series={panelA}
          event={invasion}
          tickEvery={4}
          digits={1}
        />
        <LinePanel
          x0={340}
          width={300}
          title="b. Revenue and defence spending"
          unit="trillion RUB of 2021"
          years={yearsB}
          max={12}
          ticks={[0, 4, 8, 12]}
          series={panelB}
          event={invasion}
          tickEvery={4}
        />
      </svg>
    </figure>
  );
}
