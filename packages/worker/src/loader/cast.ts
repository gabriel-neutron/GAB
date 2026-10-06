import type { Cast } from '@gab/proposal/mapping';
import { isValidImo } from '@gab/proposal/identifiers';

/** One cell as an attribute value, or the sentence that says why the cell is not one. */
export type Cell =
  | { readonly ok: true; readonly value: string | number | boolean | string[] }
  | { readonly ok: false; readonly reason: string };

const DECIMAL = /^[+-]?\d+(\.(\d+))?$/u;
const TRUE = new Set(['true', 'yes', '1']);
const FALSE = new Set(['false', 'no', '0']);

const LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const leapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const PATTERN: Readonly<
  Record<string, { shape: RegExp; order: readonly [number, number, number] }>
> = {
  // The order gives the place of the year, the month and the day in the match.
  'YYYY-MM-DD': { shape: /^(\d{4})-(\d{2})-(\d{2})$/u, order: [1, 2, 3] },
  'DD/MM/YYYY': { shape: /^(\d{2})\/(\d{2})\/(\d{4})$/u, order: [3, 2, 1] },
  'MM/DD/YYYY': { shape: /^(\d{2})\/(\d{2})\/(\d{4})$/u, order: [3, 1, 2] },
  'DD.MM.YYYY': { shape: /^(\d{2})\.(\d{2})\.(\d{4})$/u, order: [3, 2, 1] },
};

/** The day of a cell, as YYYY-MM-DD, or null when the cell does not hold the pattern or the
 * calendar holds no such day. */
export const dayOf = (text: string, pattern: string): string | null => {
  const rule = PATTERN[pattern];
  const found = rule?.shape.exec(text);
  if (rule === undefined || found === null || found === undefined) return null;
  const [yearAt, monthAt, dayAt] = rule.order;
  const [year, month, date] = [found[yearAt], found[monthAt], found[dayAt]];
  if (year === undefined || month === undefined || date === undefined) return null;
  const [y, m, d] = [Number(year), Number(month), Number(date)];
  const last = m === 2 && leapYear(y) ? 29 : LAST_DAY[m - 1];
  if (y < 1 || last === undefined || d < 1 || d > last) return null;
  return `${year}-${month}-${date}`;
};

/** Casts the trimmed text of one cell under the cast of its column. An empty cell is never
 * cast: the caller writes no key for it. */
export const castCell = (cast: Cast, key: string, text: string): Cell => {
  switch (cast.type) {
    case 'text':
      return { ok: true, value: text };
    case 'identifier':
      if (key === 'imo' && !isValidImo(text))
        return { ok: false, reason: `the IMO number "${text}" fails its check digit` };
      return { ok: true, value: text };
    case 'number': {
      const found = DECIMAL.exec(text);
      if (found === null) return { ok: false, reason: `"${text}" is not a number` };
      const decimals = found[2]?.length ?? 0;
      if (decimals > cast.scale)
        return {
          ok: false,
          reason: `"${text}" has ${String(decimals)} digits after the point, and the scale is ${String(cast.scale)}`,
        };
      return { ok: true, value: Number(text) };
    }
    case 'date': {
      const day = dayOf(text, cast.pattern);
      if (day === null) return { ok: false, reason: `"${text}" is not a day as ${cast.pattern}` };
      return { ok: true, value: day };
    }
    case 'boolean': {
      const word = text.toLowerCase();
      if (TRUE.has(word)) return { ok: true, value: true };
      if (FALSE.has(word)) return { ok: true, value: false };
      return { ok: false, reason: `"${text}" is not true or false` };
    }
    case 'list':
      return {
        ok: true,
        value: text
          .split(cast.separator)
          .map((part) => part.trim())
          .filter((part) => part !== ''),
      };
  }
};
