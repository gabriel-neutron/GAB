import raw from './data/currencies.csv?raw';
import { LinePanel, PANEL_HEIGHT, readCsv, type Series } from './line-panel';

// Figure 10: currency of settlement of Russian exports and imports of goods and services, % of total.
// "Unfriendly" is the Russian government list 430-r: the old currencies in foreground, the rouble in signal.
const rows = readCsv(raw);
const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
const KEYS = [
  { key: '“Unfriendly” currencies', label: '“Unfriendly”', tone: 'old' },
  { key: 'Rouble', label: 'Rouble', tone: 'new' },
  { key: 'Other currencies', label: 'Other', tone: 'other' },
] as const;
const panel = (series: string): Series[] =>
  KEYS.map((k) => {
    const points = years.map((y) => {
      const r = rows.find(
        (x) => x['series'] === series && x['key'] === k.key && x['year'] === String(y),
      );
      return r ? Number(r['value']) : undefined;
    });
    return {
      label: k.label,
      tone: k.tone,
      points,
      end: `${k.label} ${Math.round(points.at(-1) ?? 0)}`,
    };
  });
const invasion = { at: 2022.15, label: 'Invasion' };

export function CurrenciesFigure() {
  return (
    <figure className="report-chart">
      <svg
        viewBox={`0 0 640 ${PANEL_HEIGHT}`}
        role="img"
        aria-label="Currency of settlement of Russian exports and imports, 2019-2025"
      >
        {(
          [
            [0, 'a. Exports', 'settlement_currency_exports'],
            [340, 'b. Imports', 'settlement_currency_imports'],
          ] as const
        ).map(([x0, title, series]) => (
          <LinePanel
            key={series}
            x0={x0}
            width={300}
            title={title}
            unit="% of total"
            years={years}
            max={100}
            ticks={[0, 25, 50, 75, 100]}
            series={panel(series)}
            event={invasion}
            tickEvery={2}
            right={118}
          />
        ))}
      </svg>
    </figure>
  );
}
