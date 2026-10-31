import raw from './data/buyers.csv?raw';
import { LinePanel, PANEL_HEIGHT, readCsv, type Series } from './line-panel';

// Figure 2: Russian exports by buyer (mirror data, bn USD). Crude bought from Russia is figure 5.
// One row per value with its document. Missing values are not drawn.
// Colour: the old buyers in `foreground`, the new buyers in `signal`, the others in `chart-axis`.
const rows = readCsv(raw);
const COALITION = ['EU27', 'US', 'UK', 'Japan', 'South Korea', 'Switzerland', 'Norway'];
const row = (panel: string, series: string, year: number) =>
  rows.find((r) => r['panel'] === panel && r['series'] === series && r['period'] === String(year));
const value = (panel: string, series: string, year: number) => {
  const r = row(panel, series, year);
  return r ? Number(r['value']) : undefined;
};
const coalition = (year: number) => {
  const parts = COALITION.map((s) => value('a', s, year));
  // A year with a missing partner has no coalition total.
  return parts.every((p) => p !== undefined) ? parts.reduce((t: number, p) => t + p, 0) : undefined;
};

const yearsA = [2020, 2021, 2022, 2023, 2024, 2025];
const panelA: Series[] = [
  { label: 'Coalition', tone: 'old', points: yearsA.map(coalition) },
  ...(['China', 'India'] as const).map((s) => ({
    label: s,
    tone: 'new' as const,
    points: yearsA.map((y) => value('a', s, y)),
  })),
  ...(['Turkey', 'Kazakhstan'] as const).map((s) => ({
    label: s,
    tone: 'other' as const,
    points: yearsA.map((y) => value('a', s, y)),
  })),
];
const invasion = { at: 2022.15, label: 'Invasion' };

export function BuyersFigure() {
  return (
    <figure className="report-chart">
      <svg
        viewBox={`0 0 640 ${PANEL_HEIGHT}`}
        role="img"
        aria-label="Russian exports by buyer, 2020-2025"
      >
        <LinePanel
          x0={0}
          width={640}
          title=""
          unit="bn USD"
          years={yearsA}
          max={300}
          ticks={[0, 100, 200, 300]}
          series={panelA}
          event={invasion}
          right={110}
        />
      </svg>
    </figure>
  );
}
