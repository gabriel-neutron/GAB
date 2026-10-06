import type { WriteRequest } from '@gab/proposal/request';

import { fold } from './excerpt.ts';

type Scalar = string | number | boolean;

interface Named {
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

const WORD_DAY = /(\d{1,2})(?:st|nd|rd|th|er)?\s+([\p{L}.]+)\s+(\d{4})/gu;
const WORD_MONTH_FIRST = /([\p{L}.]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/gu;
const NUMERIC_DAY = /(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})/gu;

/** Each day that a text states, in the form of the record. A day with two readings (03/04/2024)
 * gives both, because the text does not say which one it means. */
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
  for (const [, first = '', second = '', third = ''] of text.matchAll(NUMERIC_DAY)) {
    if (first.length === 4) found.add(dayText(Number(first), Number(second), Number(third)));
    else if (third.length === 4) {
      found.add(dayText(Number(third), Number(second), Number(first)));
      found.add(dayText(Number(third), Number(first), Number(second)));
    }
  }
  return found;
};

const NUMBER = /\d(?:[\d\s,.'\u00A0\u202F]*\d)?/gu;

// One written number can mean two values: "1,234" is a thousand and more in English and a little
// more than one in French. Both readings are kept, and a match on either one passes.
const readingsOf = (written: string): number[] => {
  const plain = written.replace(/[\s'\u00A0\u202F]/gu, '');
  const readings = [Number(plain.replace(/[,.]/gu, ''))];
  for (const mark of [',', '.']) {
    const last = plain.lastIndexOf(mark);
    if (last === -1) continue;
    const whole = plain.slice(0, last).replace(/[,.]/gu, '');
    readings.push(Number(`${whole}.${plain.slice(last + 1)}`));
  }
  return readings.filter((reading) => Number.isFinite(reading));
};

const numbersIn = (text: string): number[] =>
  [...text.matchAll(NUMBER)].flatMap(([written]) => readingsOf(written));

const sameNumber = (left: number, right: number): boolean =>
  Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));

// Case, accents and white space are made the same, and then each sign that is not a letter or a
// digit, so "Rosneft PJSC" stands in "ROSNEFT, PJSC".
const plainText = (text: string): string => fold(text).text.toLowerCase().replace(/\p{M}/gu, '');

const compact = (text: string): string => plainText(text).replace(/[^\p{L}\p{N}]/gu, '');

const stated = (value: Scalar, passage: string): boolean => {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number')
    return numbersIn(passage).some((found) => sameNumber(found, Math.abs(value)));
  if (DAY.test(value) && daysIn(passage).has(value)) return true;
  if (plainText(passage).includes(plainText(value))) return true;
  const short = compact(value);
  if (short !== '' && compact(passage).includes(short)) return true;
  const asNumber = readingsOf(value);
  return (
    /^[\d\s,.'\u00A0\u202F-]+$/u.test(value) &&
    asNumber.some((reading) => numbersIn(passage).some((found) => sameNumber(found, reading)))
  );
};

const attributeValues = (
  attrs: Readonly<Record<string, { readonly v: unknown }>> | undefined,
): Named[] =>
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
const valuesOf = (act: WriteRequest): Named[] => {
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

/** The names of the values of an act that no cited passage states, in any form of that value. */
export const unstatedValues = (act: WriteRequest, passages: readonly string[]): string[] => {
  const text = passages.join('\n');
  return [
    ...new Set(
      valuesOf(act)
        .filter((named) => !stated(named.value, text))
        .map((n) => n.name),
    ),
  ];
};
