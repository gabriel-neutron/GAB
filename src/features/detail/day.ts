/** A day of the calendar, as the record holds one: a text of ten characters. The shape and the
 * calendar are one job, because `2019-02-30` has the shape and stands in no calendar. */

/** The shape of a day, which is the first of the two tests. `2019-02-30` passes it. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const leapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** Whether a text names a day that the calendar holds. The shape alone admits `2019-99-99`, so
 * each part is counted against the calendar. A browser draws no day for a text that fails here.
 * The cell would then read as a blank, and M9 keeps a blank for the unknown alone. */
export function isDay(text: string): boolean {
  if (!DATE_ONLY.test(text)) return false;
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(5, 7));
  const day = Number(text.slice(8, 10));
  const last = month === 2 && leapYear(year) ? 29 : LAST_DAY[month - 1];
  return last !== undefined && day >= 1 && day <= last;
}
