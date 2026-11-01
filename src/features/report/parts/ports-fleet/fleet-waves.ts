import wavesRaw from '../../data/fleet-waves.csv?raw';
import { readCsv } from '../../line-panel';

export const REGIMES = ['EU', 'UK', 'OFAC'] as const;
export type Regime = (typeof REGIMES)[number];

const isRegime = (value: string): value is Regime => REGIMES.some((regime) => regime === value);
const count = (value: string | undefined) => {
  const number = Number(value);
  if (value === undefined || value === '' || !Number.isInteger(number) || number < 0)
    throw new Error(`fleet-waves: "${String(value)}" is not a count`);
  return number;
};
const dateOf = (value: string | undefined) => {
  if (value === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error(`fleet-waves: "${String(value)}" is not a date`);
  return value;
};
const regimeOf = (value: string) => {
  if (!isRegime(value)) throw new Error(`fleet-waves: "${value}" is not a regime`);
  return value;
};

/** Reads the fleet-waves CSV: the new listings of each quarter, the regimes that list each tanker
 * (each tanker is in one combination only), and the date of the last designation in the data. A
 * bad regime, count or date stops the build. */
export function readWaves(raw: string) {
  const rows = readCsv(raw);
  return {
    listings: rows
      .filter((row) => row['kind'] === 'quarter')
      .map((row) => {
        const quarter = row['key'] ?? '';
        if (!/^\d{4}-Q[1-4]$/.test(quarter))
          throw new Error(`fleet-waves: "${quarter}" is not a quarter`);
        return { quarter, regime: regimeOf(row['regime'] ?? ''), value: count(row['value']) };
      }),
    combos: rows
      .filter((row) => row['kind'] === 'combo')
      .map((row) => ({
        regimes: (row['key'] ?? '').split('+').map(regimeOf),
        value: count(row['value']),
      })),
    end: dateOf(rows.find((row) => row['kind'] === 'end')?.['value']),
  };
}

const { listings, combos, end } = readWaves(wavesRaw);

// The chart starts with the first wave of 2022; the listings before it are a count in words.
const FIRST = '2022-Q1';
const quarterAt = (index: number) =>
  `${String(2022 + Math.floor(index / 4))}-Q${String((index % 4) + 1)}`;
const last = listings.reduce((top, one) => (one.quarter > top ? one.quarter : top), FIRST);
// The last day of each quarter: a quarter that ends after the last designation is partial.
const quarterEnd = (quarter: string) =>
  `${quarter.slice(0, 4)}-${['03-31', '06-30', '09-30', '12-31'][Number(quarter.slice(-1)) - 1] ?? ''}`;
const QUARTERS: readonly string[] = Array.from(
  { length: (Number(last.slice(0, 4)) - 2022) * 4 + Number(last.slice(-1)) },
  (_, index) => quarterAt(index),
);

/** The fleet-waves data for the regimes that show: the new listings of each quarter, the listings
 * before the first quarter drawn, and the tankers by the shown regimes that list them. A tanker
 * keeps its place in one group: its group is the shown part of its own combination. */
export function selectWaves(shown: ReadonlySet<string>) {
  const visible = listings.filter((one) => shown.has(one.regime));
  const sum = (quarter: string, regime: Regime) =>
    visible
      .filter((one) => one.quarter === quarter && one.regime === regime)
      .reduce((total, one) => total + one.value, 0);
  const quarters = QUARTERS.map((quarter) => ({
    quarter,
    partial: quarterEnd(quarter) > end,
    values: { EU: sum(quarter, 'EU'), UK: sum(quarter, 'UK'), OFAC: sum(quarter, 'OFAC') },
  }));
  const groups = new Map<string, { regimes: Regime[]; value: number }>();
  for (const combo of combos) {
    const regimes = REGIMES.filter((regime) => shown.has(regime) && combo.regimes.includes(regime));
    if (regimes.length === 0) continue;
    const key = regimes.join('+');
    const group = groups.get(key) ?? { regimes, value: 0 };
    groups.set(key, { regimes, value: group.value + combo.value });
  }
  const overlaps = [...groups.values()].sort((a, b) => b.value - a.value);
  return {
    quarters,
    end,
    earlier: visible
      .filter((one) => one.quarter < FIRST)
      .reduce((total, one) => total + one.value, 0),
    overlaps,
    tankers: overlaps.reduce((total, one) => total + one.value, 0),
  };
}
