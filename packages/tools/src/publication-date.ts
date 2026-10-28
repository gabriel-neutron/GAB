/** The two dates that the checker needs to read a passage that gives a weekday only: the day when
 * a document was published, and the weekday of the day that an act claims. */

import { isDay } from '@gab/proposal/day';
import { EVENT_DAYS } from '@gab/proposal/event-keys';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The English weekday of a day written as 2026-05-12, or null when the text is no real day. */
export const weekdayOf = (day: string): string | null => {
  if (!isDay(day)) return null;
  return WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()] ?? null;
};

const real = (year: string, month: string, day: string): string | null => {
  const text = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return isDay(text) && Number(year) >= 2000 ? text : null;
};

// A segment of a path that holds a date: 2026/05/13, 2026-05-13 or 20260513. A number of eight
// digits that is no real day is no date, so an identifier does not pass.
const SLASHED = /\/(\d{4})\/(\d{1,2})\/(\d{1,2})(?=[/.\-_]|$)/u;
const DASHED = /(?:^|[/_-])(\d{4})-(\d{2})-(\d{2})(?=[/.\-_]|$)/u;
const COMPACT = /\/(\d{4})(\d{2})(\d{2})(?=[/.\-_]|$)/u;

/** The day of publication that the path of a URL holds, or null. The query is not read. */
export const dateInUrl = (uri: string | null | undefined): string | null => {
  if (uri === null || uri === undefined) return null;
  let path: string;
  try {
    path = new URL(uri).pathname;
  } catch {
    return null;
  }
  for (const form of [SLASHED, DASHED, COMPACT]) {
    const found = form.exec(path);
    const day = found?.[1] && found[2] && found[3] ? real(found[1], found[2], found[3]) : null;
    if (day !== null) return day;
  }
  return null;
};

/** Each day that an act claims in `occurred_on`, with its weekday. A month or a value that is no
 * day gives nothing. */
export const occurredWeekdays = (
  act: unknown,
): readonly { readonly day: string; readonly weekday: string }[] => {
  if (typeof act !== 'object' || act === null || !('attrs' in act)) return [];
  const attrs: unknown = act.attrs;
  if (typeof attrs !== 'object' || attrs === null || !(EVENT_DAYS in attrs)) return [];
  const slot: unknown = (attrs as Record<string, unknown>)[EVENT_DAYS];
  const value = typeof slot === 'object' && slot !== null && 'v' in slot ? slot.v : undefined;
  const days = Array.isArray(value) ? (value as unknown[]) : [value];
  return days.flatMap((one) => {
    const weekday = typeof one === 'string' ? weekdayOf(one) : null;
    return typeof one === 'string' && weekday !== null ? [{ day: one, weekday }] : [];
  });
};

const OFAC_ACTION = /^https?:\/\/ofac\.treasury\.gov\/recent-actions\//u;
const RELEASE_DATE = /(Release Date:\s*)(\d{2})\/(\d{2})\/(\d{4})(?!\d)/gu;

/** On an OFAC page of recent actions, the "Release Date" line is always month/day/year. The line
 * is written as year-month-day, so the check of a stated day never takes it as ambiguous. Any
 * other date, and any other page, stays as it is. */
export const withOfacReleaseDate = (uri: string | null, text: string): string =>
  uri !== null && OFAC_ACTION.test(uri)
    ? text.replace(
        RELEASE_DATE,
        (_whole, head: string, month: string, day: string, year: string) =>
          `${head}${year}-${month}-${day}`,
      )
    : text;
