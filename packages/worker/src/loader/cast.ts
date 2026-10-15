import type { Cast } from '@gab/proposal/mapping';
import { isDay } from '@gab/proposal/day';
import { isValidImo, isValidLei } from '@gab/proposal/identifiers';

/** One cell as an attribute value, or the sentence that says why the cell is not one. A refused
 * cell excludes its row. A skipped cell holds no value of its key, and the row keeps its other
 * cells: a register writes "not found" where it has no LEI. */
export type Cell =
  | { readonly ok: true; readonly value: string | number | boolean | string[] }
  | { readonly ok: false; readonly reason: string }
  | { readonly ok: 'skip'; readonly reason: string };

const DECIMAL = /^[+-]?\d+(\.(\d+))?$/u;
const TRUE = new Set(['true', 'yes', '1']);
const FALSE = new Set(['false', 'no', '0']);

// External constraint: the Russian register. A company has a tax number (INN) of ten digits and a
// registration number (OGRN) of thirteen. A person has an INN of twelve digits and an OGRNIP of
// fifteen. An INN can start with a zero, and an OGRN or an OGRNIP never does.
const DIGITS = /^\d+$/u;
const TAX_LENGTHS = new Map([
  [9, 10],
  [10, 10],
  [11, 12],
  [12, 12],
]);
const REGISTRATION_LENGTHS = new Set([13, 15]);

/** A number of the Russian register under one key: a tax number with the zeros that a workbook
 * removed from its start, or a registration number. */
const registerCell = (key: string, text: string): Cell => {
  if (!DIGITS.test(text))
    return { ok: 'skip', reason: `"${text}" is not a number of the Russian register` };
  const taxLength = TAX_LENGTHS.get(text.length);
  if (key === 'tax_id') {
    if (taxLength !== undefined) return { ok: true, value: text.padStart(taxLength, '0') };
    if (REGISTRATION_LENGTHS.has(text.length))
      return { ok: 'skip', reason: `"${text}" is a registration number, and not a tax number` };
  }
  if (key === 'registration_number') {
    if (REGISTRATION_LENGTHS.has(text.length)) return { ok: true, value: text };
    if (taxLength !== undefined)
      return { ok: 'skip', reason: `"${text}" is a tax number, and not a registration number` };
  }
  return { ok: 'skip', reason: `"${text}" is not a number of the Russian register for ${key}` };
};

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
  const built = `${year}-${month}-${date}`;
  return Number(year) >= 1 && isDay(built) ? built : null;
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
      if (key === 'lei') {
        const lei = text.toUpperCase();
        return isValidLei(lei)
          ? { ok: true, value: lei }
          : { ok: 'skip', reason: `"${text}" is not a LEI in its legal form` };
      }
      return { ok: true, value: text };
    case 'ru_register':
      return registerCell(key, text);
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
