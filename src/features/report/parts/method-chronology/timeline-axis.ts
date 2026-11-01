/** The time axis of figure 1: the place of a date on the axis, and the mapping between the page
 * scroll and the cursor line. */

export const START = 2014;
export const END = 2027;
export const YEARS = Array.from({ length: END - START }, (_, index) => START + index);
// The figure has no event from 2015 to 2021, so the axis folds these years into one gap.
export const GAP = [2015, 2022] as const;
export const GAP_PX = 320;
// 340px for one year keeps 160px labels clear of the next stem in the same band.
export const PX_PER_YEAR = 340;
export const PAD = 96;
export const TRACK = (END - START - (GAP[1] - GAP[0])) * PX_PER_YEAR + GAP_PX + 2 * PAD;
export const AXIS_YEARS = YEARS.filter((year) => year <= GAP[0] || year >= GAP[1]);
export const YEAR_MS = 365.25 * 24 * 3600 * 1000;
/** The place on the axis of a time in years, for example 2022.5. */
export const xOfTime = (time: number): number => {
  if (time <= GAP[0]) return PAD + (time - START) * PX_PER_YEAR;
  const gapStart = PAD + (GAP[0] - START) * PX_PER_YEAR;
  if (time < GAP[1]) return gapStart + ((time - GAP[0]) / (GAP[1] - GAP[0])) * GAP_PX;
  return gapStart + GAP_PX + (time - GAP[1]) * PX_PER_YEAR;
};
export const xOf = (date: string): number =>
  xOfTime(START + (Date.parse(date) - Date.UTC(START, 0, 1)) / YEAR_MS);
export const xOfYear = (year: number): number => xOfTime(year);
/** The year under a place on the axis, or the gap label inside the gap. */
export const yearAt = (x: number): string => {
  const gapStart = xOfTime(GAP[0]);
  if (x < gapStart) return String(Math.max(START, START + Math.floor((x - PAD) / PX_PER_YEAR)));
  if (x < gapStart + GAP_PX) return '//';
  return String(Math.min(END - 1, GAP[1] + Math.floor((x - gapStart - GAP_PX) / PX_PER_YEAR)));
};
/** The cursor line on the axis at a shift of the axis: it crosses the view as the axis moves, so
 * that it meets the start of the axis at shift 0 and its end at the last shift. */
export const cursorAt = (shift: number, view: number): number =>
  shift + (shift / Math.max(1, TRACK - view)) * view;

/** The shift of the axis that puts the cursor line on `x`: the inverse of `cursorAt`. */
export const shiftFor = (x: number, view: number): number => (x * (TRACK - view)) / TRACK;

/** The step at a cursor line: the last event at or before it, or the first event. */
export const stepAt = (dates: readonly string[], x: number): number =>
  Math.max(0, dates.filter((date) => xOf(date) <= x).length - 1);
