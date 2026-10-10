import type { TimelineLane } from './vessel-timeline.ts';

/** The span of time that a timeline draws, as days YYYY-MM-DD, and the first day of each year to
 * mark on its axis. */
export interface TimelineAxis {
  readonly start: string;
  readonly end: string;
  readonly years: readonly string[];
  /** The place of a day on the axis, from 0 at its start to 1 at its end. */
  readonly at: (day: string) => number;
}

// Origin: about ten year marks fit the width of a page at the smallest text of the site.
const MOST_YEAR_MARKS = 10;

const yearOf = (day: string): number => Number(day.slice(0, 4));

/** The axis of the dated marks of the lanes, from the first day of the year of the oldest bound
 * to the date of the version, or to a later bound. Null when no mark has a date. */
export const timelineAxis = (
  lanes: readonly TimelineLane[],
  versionDate: string,
): TimelineAxis | null => {
  const days = lanes.flatMap((lane) =>
    lane.marks.flatMap((mark) => {
      if (mark.time.kind === 'day') return [mark.time.day];
      if (mark.time.kind === 'interval')
        return [mark.time.from, mark.time.to].filter((one) => one !== null);
      return [];
    }),
  );
  if (days.length === 0) return null;
  const sorted = [...days, versionDate].sort();
  const first = sorted[0] ?? versionDate;
  const last = sorted[sorted.length - 1] ?? versionDate;
  const start = `${String(yearOf(first))}-01-01`;
  const end = last;
  const from = Date.parse(start);
  const span = Math.max(Date.parse(end) - from, 1);
  const count = yearOf(end) - yearOf(start);
  const step = Math.max(1, Math.ceil(count / MOST_YEAR_MARKS));
  const years: string[] = [];
  for (let year = yearOf(start); year <= yearOf(end); year += step)
    years.push(`${String(year)}-01-01`);
  return { start, end, years, at: (day) => (Date.parse(day) - from) / span };
};
