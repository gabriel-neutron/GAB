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
const MONTHS: readonly (readonly string[])[] = [
  ['january', 'janvier', 'janv'],
  ['february', 'février', 'fevrier', 'févr', 'fevr'],
  ['march', 'mars'],
  ['april', 'avril', 'avr'],
  ['may', 'mai'],
  ['june', 'juin'],
  ['july', 'juillet', 'juil'],
  ['august', 'août', 'aout'],
  ['september', 'septembre', 'sept'],
  ['october', 'octobre'],
  ['november', 'novembre'],
  ['december', 'décembre', 'decembre'],
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

const WORD_DAY = /(?<!\d)(\d{1,2})(?:st|nd|rd|th|er)?\s+([\p{L}.]+)\s+(\d{4})(?!\d)/gu;
const WORD_MONTH_FIRST = /([\p{L}.]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?!\d)/gu;
const NUMERIC_DAY = /(?<![\d.,/-])(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})(?![\d.,/-]?\d)/gu;

// Origin: decided. 03/04/2024 is the third of April in Europe and the fourth of March in the
// United States, and the text does not say which. Such a day states neither, so the item is
// disputed and the operator reads the page. A part above 12 can only be the day.
const numericDays = (first: string, second: string, third: string): string[] => {
  if (first.length === 4) return [dayText(Number(first), Number(second), Number(third))];
  if (third.length !== 4) return [];
  const [one, two, year] = [Number(first), Number(second), Number(third)];
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
  for (const [, first = '', second = '', third = ''] of text.matchAll(NUMERIC_DAY))
    for (const day of numericDays(first, second, third)) found.add(day);
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

// The value stands in the passage as one whole token: no letter and no digit touches it, and no
// sign that joins it to a letter or a digit. So an identifier with a hyphen, as "30616-4", stands
// in "(military unit 30616-4)", but not in "30616-45" or in "30616-4-1".
const statesToken = (value: string, passage: string): boolean => {
  const wanted = plainText(value).trim();
  if (wanted === '') return false;
  return new RegExp(
    String.raw`(?<![\p{L}\d])(?<![\p{L}\d][-./_,])${escaped(wanted)}(?![\p{L}\d])(?![-./_,][\p{L}\d])`,
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
