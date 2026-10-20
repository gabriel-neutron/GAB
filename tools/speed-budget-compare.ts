// The compare of the speed measure with the budget. Pure code: the command in
// `speed-budget.ts` measures, and this file only decides pass or fail.

/** The limits of one page. A time or a weight is a maximum. The frame rate is a minimum. */
export interface PageBudget {
  readonly mainContentMs: number;
  readonly inputMs: number;
  readonly weightKb: number;
  readonly minFps?: number;
}

/** What one run measured on one page. A page that cannot be measured has a `skipped` reason. */
export type PageMeasure =
  | { readonly skipped: string }
  | {
      readonly skipped?: undefined;
      readonly mainContentMs: number;
      readonly inputMs: number;
      readonly weightKb: number;
      readonly fps?: number;
    };

export type Status = 'pass' | 'fail' | 'skip';

export interface Row {
  readonly page: string;
  readonly metric: string;
  readonly value: string;
  readonly limit: string;
  readonly status: Status;
}

const row = (
  page: string,
  metric: string,
  value: number,
  limit: number,
  unit: string,
  isMinimum: boolean,
): Row => ({
  page,
  metric,
  value: `${Math.round(value)} ${unit}`,
  limit: `${isMinimum ? '>=' : '<='} ${limit} ${unit}`,
  status: (isMinimum ? value >= limit : value <= limit) ? 'pass' : 'fail',
});

/** One row for each metric of each page of the budget. A skipped page gives one `skip` row and
 * never a failure. A page with no measure at all is a failure, because the run lost it. */
export function compare(
  budget: Readonly<Record<string, PageBudget>>,
  measures: Readonly<Record<string, PageMeasure | undefined>>,
): readonly Row[] {
  return Object.entries(budget).flatMap(([page, limits]): readonly Row[] => {
    const measure = measures[page];
    if (measure === undefined)
      return [{ page, metric: 'all', value: 'not measured', limit: '-', status: 'fail' }];
    if (measure.skipped !== undefined)
      return [{ page, metric: 'all', value: measure.skipped, limit: '-', status: 'skip' }];
    const rows = [
      row(page, 'main content', measure.mainContentMs, limits.mainContentMs, 'ms', false),
      row(page, 'input response', measure.inputMs, limits.inputMs, 'ms', false),
      row(page, 'weight', measure.weightKb, limits.weightKb, 'kB', false),
    ];
    if (limits.minFps !== undefined && measure.fps !== undefined)
      rows.push(row(page, 'pan frame rate', measure.fps, limits.minFps, 'fps', true));
    return rows;
  });
}

/** True when no row fails. */
export const passes = (rows: readonly Row[]): boolean => rows.every((one) => one.status !== 'fail');

/** The table that the command prints. */
export function table(rows: readonly Row[]): string {
  const head = ['page', 'metric', 'value', 'limit', 'status'];
  const cells = rows.map((one) => [one.page, one.metric, one.value, one.limit, one.status]);
  const widths = head.map((title, at) =>
    Math.max(title.length, ...cells.map((line) => line[at]?.length ?? 0)),
  );
  const line = (parts: readonly string[]): string =>
    parts.map((part, at) => part.padEnd(widths[at] ?? 0)).join('  ');
  return [line(head), ...cells.map(line)].join('\n');
}
