import type { WriteRequest } from '@gab/proposal/request';

import { fold } from './excerpt.ts';

type Scalar = string | number | boolean;

/** One value of an act: the field that holds it, and the value. */
interface ActValue {
  readonly name: string;
  readonly value: Scalar;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/u;

// The words of a month in the languages of the corpus. A short form is a prefix of three letters.
// Russian writes a day with the month in the genitive: "2 мая 2019 г.".
const MONTHS: readonly (readonly string[])[] = [
  ['january', 'janvier', 'janv', 'январь', 'января'],
  ['february', 'février', 'fevrier', 'févr', 'fevr', 'февраль', 'февраля'],
  ['march', 'mars', 'март', 'марта'],
  ['april', 'avril', 'avr', 'апрель', 'апреля'],
  ['may', 'mai', 'май', 'мая'],
  ['june', 'juin', 'июнь', 'июня'],
  ['july', 'juillet', 'juil', 'июль', 'июля'],
  ['august', 'août', 'aout', 'август', 'августа'],
  ['september', 'septembre', 'sept', 'сентябрь', 'сентября'],
  ['october', 'octobre', 'октябрь', 'октября'],
  ['november', 'novembre', 'ноябрь', 'ноября'],
  ['december', 'décembre', 'decembre', 'декабрь', 'декабря'],
];

const monthOf = (word: string): number | null => {
  const lower = word.toLowerCase().replace(/\.$/u, '');
  const index = MONTHS.findIndex((names) =>
    names.some((name) => name === lower || (lower.length >= 3 && name.startsWith(lower))),
  );
  return index === -1 ? null : index + 1;
};

const dayText = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// Between the day and the month: a space, "of", a comma or a hyphen ("2nd of May, 2019",
// "02-May-2019"). Between the month and the year: a space, a comma or a hyphen.
const WORD_DAY =
  /(?<!\d)(\d{1,2})(?:st|nd|rd|th|er)?(?:\s+of\s+|\s*,\s*|\s+|-)([\p{L}.]+)(?:\s*,\s*|\s+|-)(\d{4})(?!\d)/gu;
const WORD_MONTH_FIRST = /([\p{L}.]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?!\d)/gu;
const NUMERIC_DAY = /(?<![\d.,/-])(\d{1,4})([./-])(\d{1,2})\2(\d{1,4})(?![\d.,/-]?\d)/gu;

// Origin: decided. A day with dots, 05.03.2024, is day, month and year in each country that
// writes it so (the EU, Russia). 03/04/2024 is the third of April in Europe and the fourth of
// March in the United States, and the text does not say which: such a day states neither, so a
// value with it is not stated. A part above 12 can only be the day.
const numericDays = (first: string, mark: string, second: string, third: string): string[] => {
  if (first.length === 4) return [dayText(Number(first), Number(second), Number(third))];
  if (third.length !== 4) return [];
  const [one, two, year] = [Number(first), Number(second), Number(third)];
  if (mark === '.') return [dayText(year, two, one)];
  if (one > 12) return [dayText(year, two, one)];
  if (two > 12) return [dayText(year, one, two)];
  return one === two ? [dayText(year, one, one)] : [];
};

/** Each day that a text states, in the form of the record. A day with two readings (03/04/2024)
 * states no day, because the text does not say which one it means. */
const daysIn = (text: string): Set<string> => {
  const found = new Set<string>();
  for (const [, day, word, year] of text.matchAll(WORD_DAY)) {
    const month = monthOf(word ?? '');
    if (month !== null) found.add(dayText(Number(year), month, Number(day)));
  }
  for (const [, word, day, year] of text.matchAll(WORD_MONTH_FIRST)) {
    const month = monthOf(word ?? '');
    if (month !== null) found.add(dayText(Number(year), month, Number(day)));
  }
  for (const [, first = '', mark = '', second = '', third = ''] of text.matchAll(NUMERIC_DAY))
    for (const day of numericDays(first, mark, second, third)) found.add(day);
  return found;
};

// A space between two groups of digits joins them only when the group after it holds three
// digits: "41 200" is one number, and "2024 41" is two.
const NUMBER = /\d+(?:[\s'\u00A0\u202F](?=\d{3}(?!\d))\d{3}|[,.](?=\d)\d+)*/gu;

// The first group of a grouped number: one to three digits, and no zero in front.
const FIRST_GROUP = /^[1-9]\d{0,2}$/u;

const isGrouping = (groups: readonly string[]): boolean =>
  FIRST_GROUP.test(groups[0] ?? '') && groups.slice(1).every((group) => /^\d{3}$/u.test(group));

// Origin: decided. A written number has one reading, or none. "1,234" is a thousand and more in
// English and a little more than one in French, and "1.000" is a thousand in German and one in
// English. Such a number states no value, so the item is disputed and the operator reads the
// page. Two different marks, or one mark that comes back, give one reading.
const readingsOf = (written: string): number[] => {
  const plain = written.replace(/[\s'\u00A0\u202F]/gu, '');
  const marks = plain.replace(/[^,.]/gu, '');
  const last = marks.at(-1);
  if (last === undefined) return [Number(plain)].filter(Number.isFinite);
  const other = last === ',' ? '.' : ',';
  const parts = plain.split(last);
  if (parts.length > 2)
    return marks.includes(other) || !isGrouping(parts) ? [] : [Number(parts.join(''))];
  const [whole = '', fraction = ''] = parts;
  if (marks.includes(other)) {
    const groups = whole.split(other);
    return isGrouping(groups) ? [Number(`${groups.join('')}.${fraction}`)] : [];
  }
  if (fraction.length === 3 && FIRST_GROUP.test(whole)) return [];
  return [Number(`${whole}.${fraction}`)].filter(Number.isFinite);
};

const numbersIn = (text: string): number[] =>
  [...text.matchAll(NUMBER)].flatMap(([written]) => readingsOf(written));

// A minus sign that stands after no letter and no digit, or a word that says minus, makes the
// number after it negative. "3-5" is a range, and "ID-5" is a name: neither one states -5.
const SIGNED = new RegExp(
  `(?:(?<![\\p{L}\\d])[-\u2212]\\s?|(?<!\\p{L})(?:minus|moins|negative|négatif|negatif)\\s+)(${NUMBER.source})`,
  'giu',
);

const negativesIn = (text: string): number[] =>
  [...text.matchAll(SIGNED)].flatMap(([, written = '']) =>
    readingsOf(written).map((reading) => -reading),
  );

const sameNumber = (left: number, right: number): boolean =>
  Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));

// Case, accents and white space are made the same.
const plainText = (text: string): string => fold(text).text.toLowerCase().replace(/\p{M}/gu, '');

// The words and the numbers of a text. A number keeps its marks, so "1,000" and "1.000" are two
// different words.
const wordsOf = (text: string): string[] => plainText(text).match(/\d+(?:[.,]\d+)*|\p{L}+/gu) ?? [];

const isDigit = (point: string | undefined): boolean => point !== undefined && /\d/u.test(point);

// The words that state a yes or a no, in the languages of the corpus.
const YES_NO: Readonly<Record<'true' | 'false', readonly string[]>> = {
  true: ['yes', 'true', 'oui', 'vrai'],
  false: ['no', 'false', 'non', 'faux'],
};

// The words of the value stand side by side in the passage, whole, and a sign between them is
// free, so "Rosneft PJSC" stands in "ROSNEFT, PJSC" and "SA" stands in "S.A.". A part of a word
// states nothing, so "100" does not stand in "1000". Two numbers never join: "1 000" does not
// state "1000" as a word, and the check of a number reads it.
const statesWords = (value: string, passage: string): boolean => {
  const wanted = wordsOf(value).join('');
  if (wanted === '') return false;
  const words = wordsOf(passage);
  return words.some((_, first) => {
    let joined = '';
    for (let at = first; at < words.length && joined.length < wanted.length; at += 1) {
      const word = words[at] ?? '';
      if (isDigit(joined.at(-1)) && isDigit(word[0])) return false;
      joined += word;
    }
    return joined === wanted;
  });
};

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const NUMERIC_TEXT = /^-?[\d\s,.'\u00A0\u202F]+$/u;

// The value stands in the passage as one whole token: no letter and no digit touches it, and no
// sign that joins it to a letter or a digit. So an identifier with a hyphen, as "30616-4", stands
// in "(military unit 30616-4)", but not in "30616-45", "30616-4-1" or "30616-4:1". A space or an
// apostrophe before or after a digit can group the digits of one number, so "A 1 000" does not
// stand in "A 1 000 000". A value of digits and marks only is a number, and the check of a number
// reads it. A value with no letter and no digit states nothing.
const statesToken = (value: string, passage: string): boolean => {
  const wanted = plainText(value).trim();
  if (!/[\p{L}\d]/u.test(wanted) || NUMERIC_TEXT.test(wanted)) return false;
  const before = /^\d/u.test(wanted) ? String.raw`(?<!\d[\s'])` : '';
  const after = /\d$/u.test(wanted) ? String.raw`(?![\s']\d)` : '';
  return new RegExp(
    String.raw`(?<![\p{L}\d])(?<![\p{L}\d][^\s\p{L}\d])${before}${escaped(wanted)}(?![\p{L}\d])(?![^\s\p{L}\d][\p{L}\d])${after}`,
    'u',
  ).test(plainText(passage));
};

const stated = (value: Scalar, passage: string): boolean => {
  if (typeof value === 'boolean') {
    const words = wordsOf(passage);
    return YES_NO[value ? 'true' : 'false'].some((word) => words.includes(word));
  }
  if (typeof value === 'number')
    return (value < 0 ? negativesIn(passage) : numbersIn(passage)).some((found) =>
      sameNumber(found, value),
    );
  if (DAY.test(value) && daysIn(passage).has(value)) return true;
  if (statesWords(value, passage)) return true;
  if (statesToken(value, passage)) return true;
  const asNumber = readingsOf(value);
  return (
    /^[\d\s,.'\u00A0\u202F-]+$/u.test(value) &&
    asNumber.some((reading) => numbersIn(passage).some((found) => sameNumber(found, reading)))
  );
};

const attributeValues = (
  attrs: Readonly<Record<string, { readonly v: unknown }>> | undefined,
): ActValue[] =>
  Object.entries(attrs ?? {}).flatMap(([key, held]) =>
    (Array.isArray(held.v) ? held.v : [held.v])
      .filter(
        (one): one is Scalar =>
          typeof one === 'string' || typeof one === 'number' || typeof one === 'boolean',
      )
      .map((one) => ({ name: `attrs.${key}`, value: one })),
  );

// The type of an entity or a relation is a word of the vocabulary, and a page never states it in
// that form. The two ends of a relation are identifiers. So neither one is read in the text.
const valuesOf = (act: WriteRequest): ActValue[] => {
  switch (act.op) {
    case 'create_entity':
      return [{ name: 'label', value: act.label }, ...attributeValues(act.attrs)];
    case 'create_relation':
      return [
        ...(act.validFrom === undefined ? [] : [{ name: 'validFrom', value: act.validFrom }]),
        ...(act.validTo === undefined ? [] : [{ name: 'validTo', value: act.validTo }]),
        ...attributeValues(act.attrs),
      ];
    case 'update_attrs':
      return attributeValues(act.attrs);
    default:
      return [];
  }
};

/** The values of an act that no cited passage states, in any form of that value. */
export const unstatedValues = (act: WriteRequest, passages: readonly string[]): ActValue[] => {
  const text = passages.join('\n');
  return valuesOf(act).filter((named) => !stated(named.value, text));
};

/** The name of a bound of a relation. */
export type BoundName = 'validFrom' | 'validTo';

/** The act with no value for each bound that `dropped` names. */
export const withoutBounds = <
  Act extends { validFrom?: string | undefined; validTo?: string | undefined },
>(
  act: Act,
  dropped: readonly BoundName[],
): Act => {
  const kept = { ...act };
  if (dropped.includes('validFrom')) delete kept.validFrom;
  if (dropped.includes('validTo')) delete kept.validTo;
  return kept;
};

/** The two bounds of a relation. Each one is a day that a cited passage states, or it is not
 * proposed: a bound that no passage states is removed from the act, and `dropped` names it. The
 * other values of the act stay, and an unstated one marks the item as disputed. The end of an
 * act that closes a relation is the whole act, so it stays, and `dropped` names it. */
export const statedBounds = (
  act: WriteRequest,
  passages: readonly string[],
): { readonly act: WriteRequest; readonly dropped: BoundName[] } => {
  const text = passages.join('\n');
  if (act.op === 'update_relation')
    return { act, dropped: stated(act.validTo, text) ? [] : ['validTo'] };
  if (act.op !== 'create_relation') return { act, dropped: [] };
  const dropped = (['validFrom', 'validTo'] as const).filter((name) => {
    const day = act[name];
    return day !== undefined && !stated(day, text);
  });
  return { act: withoutBounds(act, dropped), dropped };
};
