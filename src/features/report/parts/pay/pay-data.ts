import figures from '../../data/publication-figures.json';

/** One value of a chart. `null` is a missing value: the line breaks there, it never drops to 0. */
export type Point = { readonly x: number; readonly y: number; readonly hollow: boolean } | null;

// Figure 4 counts months from December 2022, its first month.
const FIRST_YEAR = 2022;
const FIRST_MONTH = 12;

/** The place of a date ("2025-09" or "2025-09-03") on the month axis of figure 4. */
export function monthIndex(date: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return (year - FIRST_YEAR) * 12 + month - FIRST_MONTH + (day - 1) / days;
}

// The last month of the data of figure 4.
const LAST_INDEX = Math.max(
  ...[...figures.f4.brent, ...figures.f4.urals].map(([date]) =>
    Math.floor(monthIndex(String(date))),
  ),
);

/** One value for each month of figure 4; a month with no value stays null. */
function monthly(rows: readonly (readonly (string | number)[])[]): Point[] {
  const byIndex = new Map(rows.map(([date, value]) => [monthIndex(String(date)), Number(value)]));
  return Array.from({ length: LAST_INDEX + 1 }, (_, index) => {
    const value = byIndex.get(index);
    return value === undefined ? null : { x: index, y: value, hollow: false };
  });
}

/** One value for each year from `from` to `to`; a year with no value stays null. A value whose
 * status is in `hollow` is an estimate or a plan. */
function yearly(
  rows: readonly (readonly (string | number)[])[],
  from: number,
  to: number,
  hollow: readonly string[] = [],
  scale = 1,
): Point[] {
  return Array.from({ length: to - from + 1 }, (_, index) => {
    const row = rows.find(([year]) => year === from + index);
    const value = row?.[1];
    if (typeof value !== 'number') return null;
    const status = row?.[2];
    return {
      x: from + index,
      y: value / scale,
      hollow: typeof status === 'string' && hollow.includes(status),
    };
  });
}

const series = <T extends { readonly k: string }>(rows: readonly T[], key: string): T => {
  const found = rows.find((row) => row.k === key);
  if (found === undefined) throw new Error(`No series ${key} in the publication figures.`);
  return found;
};

const ESTIMATE = ['estimate'];
const PLAN = ['plan'];

/** The data of figures 3, 4 and 5, read from the data of the PDF figures. */
export const payData = {
  f3a: (['Coalition', 'China', 'India', 'Turkey', 'Kazakhstan'] as const).map((key) => ({
    key,
    points: yearly(series(figures.f3a, key).v, 2020, 2025),
  })),
  f3b: (['EU27', 'China', 'India', 'Turkey'] as const).map((key) => ({
    key,
    points: yearly(series(figures.f3b, key).v, 2021, 2025, ESTIMATE),
  })),
  f4: {
    brent: monthly(figures.f4.brent),
    urals: monthly(figures.f4.urals),
    caps: figures.f4.cap.map(([date, value]) => ({
      x: monthIndex(String(date)),
      value: Number(value),
    })),
    event: monthIndex(figures.f4.event),
    last: LAST_INDEX,
  },
  f5: {
    share: yearly(figures.f5.share, 2014, 2026),
    share9: yearly(figures.f5.share9, 2014, 2026).map((point) =>
      point === null ? null : { ...point, hollow: true },
    ),
    // Billion roubles of 2021 in the data, trillion in the figure.
    revenue: yearly(figures.f5.rev, 2014, 2025, [], 1000),
    defence: yearly(figures.f5.def, 2014, 2025, PLAN, 1000),
  },
} as const;

/** The first place where line `a` goes from above line `b` to below it, by linear interpolation
 * between two known values of both; undefined when it never does. */
export function crossing(
  a: readonly Point[],
  b: readonly Point[],
): { x: number; y: number } | undefined {
  for (let index = 1; index < a.length; index++) {
    const [a0, a1, b0, b1] = [a[index - 1], a[index], b[index - 1], b[index]];
    if (!a0 || !a1 || !b0 || !b1) continue;
    const before = a0.y - b0.y;
    const after = a1.y - b1.y;
    if (before <= 0 || after >= 0) continue;
    const share = before / (before - after);
    return { x: a0.x + share * (a1.x - a0.x), y: a0.y + share * (a1.y - a0.y) };
  }
  return undefined;
}
