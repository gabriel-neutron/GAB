import type { WriteRequest } from '@gab/proposal/request';

import { EVENT_KIND, EVENT_PRECISION } from './event-rules.ts';
import { fold } from './excerpt.ts';

type Scalar = string | number | boolean;

/** One value of an act: the field that holds it, and the value. */
interface ActValue {
  readonly name: string;
  readonly value: Scalar;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/u;

// The words of a month in the languages of the corpus. A short form is a prefix of three letters.
// Russian and Ukrainian write a day with the month in the genitive: "2 мая 2019 г.".
const MONTHS: readonly (readonly string[])[] = [
  ['january', 'janvier', 'janv', 'январь', 'января', 'січня'],
  ['february', 'février', 'fevrier', 'févr', 'fevr', 'февраль', 'февраля', 'лютого'],
  ['march', 'mars', 'март', 'марта', 'березня'],
  ['april', 'avril', 'avr', 'апрель', 'апреля', 'квітня'],
  ['may', 'mai', 'май', 'мая', 'травня'],
  ['june', 'juin', 'июнь', 'июня', 'червня'],
  ['july', 'juillet', 'juil', 'июль', 'июля', 'липня'],
  ['august', 'août', 'aout', 'август', 'августа', 'серпня'],
  ['september', 'septembre', 'sept', 'сентябрь', 'сентября', 'вересня'],
  ['october', 'octobre', 'октябрь', 'октября', 'жовтня'],
  ['november', 'novembre', 'ноябрь', 'ноября', 'листопада'],
  ['december', 'décembre', 'decembre', 'декабрь', 'декабря', 'грудня'],
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
// A Ukrainian night: "у ніч на 15 травня". The night starts on the day before the day that it
// names, so it states two days. The year is the one that the text gives, or else the year of the
// publication date of the document.
const NIGHT_DAY = /(?<!\p{L})у\s+ніч\s+на\s+(\d{1,2})\s+([\p{L}]+)(?:\s+(\d{4})(?!\d))?/giu;
// An English night with two days: "on the night of September 5 to 6", "overnight on September 5
// to 6", with a year or not. The second day must be the day after the first.
// shortcut: no "night of 5 to 6 September" and no night over the end of a month; add them when a
// stored excerpt needs them.
const NIGHT_OF =
  /(?<!\p{L})(?:night\s+of|overnight\s+on)\s+([\p{L}.]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|-|–)\s*(\d{1,2})(?!\d)(?:st|nd|rd|th)?(?:,?\s+(\d{4})(?!\d))?/giu;
// A news dateline with no year, "MOSCOW, Feb 24 (Reuters) -" or "Sept 17 (Reuters) -", at the start
// of a line. With a night word in the cited text, it states the night that ends on that day
// (decided by the expert panel), and only for the days of an event with the precision night. The
// dateline alone states no day: it is the day of the report, and not of the event. "Saturday
// night" or "last night" names another night, so it is no night word.
// shortcut: no "on Monday"; add it when a stored excerpt needs it.
const DATELINE =
  /^\s*(?:[A-Z][A-Z .'/-]+,\s+)?(\p{Lu}\p{Ll}{2,8})\.?\s+(\d{1,2})\s+\((?:Reuters|AP|AFP)\)/gmu;
const NIGHT_WORD = /\b(?:overnight|(?<!(?:day|last|tomorrow)\s+)night(?:time)?)\b/iu;
const NUMERIC_DAY = /(?<![\d.,/-])(\d{1,4})([./-])(\d{1,2})\2(\d{1,4})(?![\d.,/-]?\d)/gu;

// Origin: decided. A day with dots, 05.03.2024, is day, month and year in each country that
// writes it so (the EU, Russia). 03/04/2024 is the third of April in Europe and the fourth of
// March in the United States, and the text does not say which: such a day states neither, so a
// value with it is not stated. A part above 12 can only be the day. The FCDO UK Sanctions List
// writes each date as day, month and year (ADR 0024), so a passage of it reads 03/04/2024 as
// day/month.
const numericDays = (
  first: string,
  mark: string,
  second: string,
  third: string,
  dayFirst: boolean,
): string[] => {
  if (first.length === 4) return [dayText(Number(first), Number(second), Number(third))];
  if (third.length !== 4) return [];
  const [one, two, year] = [Number(first), Number(second), Number(third)];
  if (mark === '.' || (dayFirst && mark === '/')) return [dayText(year, two, one)];
  if (one > 12) return [dayText(year, two, one)];
  if (two > 12) return [dayText(year, one, two)];
  return one === two ? [dayText(year, one, one)] : [];
};

const isRealDay = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

// Origin: decided, not calibrated. A 29 February is at most eight years back, and a text speaks of
// a day in the past few years.
const MOST_YEARS_BACK = 8;

// The year of a day that the text writes with no year: the latest year that puts the day on or
// before the publication day. A text never speaks of a day to come. A day that some years lack
// (29 February) takes the latest year that has it.
const yearBefore = (day: number, month: number, published: string): number | null => {
  const [year = 0] = published.split('-').map(Number);
  for (let candidate = year; candidate > year - MOST_YEARS_BACK; candidate -= 1)
    if (isRealDay(candidate, month, day) && dayText(candidate, month, day) <= published)
      return candidate;
  return null;
};

// The two days of a night that ends on the given day, or none when the year or the day is unknown.
// The date is checked, so "31 червня" states nothing. A night that ends on 1 January starts on
// 31 December of the previous year. A year that the text writes always wins over the publication
// day.
const nightDays = (
  day: number,
  month: number | null,
  written: string | undefined,
  publishedOn: string | undefined,
): string[] => {
  if (month === null) return [];
  const year =
    written !== undefined
      ? Number(written)
      : publishedOn !== undefined && DAY.test(publishedOn)
        ? yearBefore(day, month, publishedOn)
        : null;
  if (year === null || !isRealDay(year, month, day)) return [];
  const end = new Date(Date.UTC(year, month - 1, day));
  const start = new Date(end.getTime() - 86_400_000);
  const text = (date: Date): string =>
    dayText(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  return [text(start), text(end)];
};

/** Options of the check. */
export interface StatedOptions {
  /** The day when the document was published, in the form of the record. A date with no year
   * takes its year from it. With no such day, a date with no year states nothing. */
  readonly publishedOn?: string | undefined;
  /** Each passage comes from the FCDO UK Sanctions List, so a date with slashes is day/month. */
  readonly dayFirst?: boolean | undefined;
}

// Code reads a night from a news dateline only for an event with the precision night.
type DayOptions = StatedOptions & { readonly nightEvent?: boolean };

const isNightEvent = (act: WriteRequest): boolean =>
  act.op === 'create_entity' && act.type === 'event' && act.attrs?.[EVENT_PRECISION]?.v === 'night';

/** Each day that a text states, in the form of the record. A day with two readings (03/04/2024)
 * states no day, because the text does not say which one it means. */
const daysIn = (
  text: string,
  { publishedOn, dayFirst = false, nightEvent = false }: DayOptions,
): Set<string> => {
  const found = new Set<string>();
  for (const [, day, word, written] of text.matchAll(NIGHT_DAY))
    for (const night of nightDays(Number(day), monthOf(word ?? ''), written, publishedOn))
      found.add(night);
  for (const [, word, first, last, written] of text.matchAll(NIGHT_OF))
    if (Number(first) + 1 === Number(last))
      for (const night of nightDays(Number(last), monthOf(word ?? ''), written, publishedOn))
        found.add(night);
  if (nightEvent && NIGHT_WORD.test(text))
    for (const [, word, day] of text.matchAll(DATELINE))
      for (const night of nightDays(Number(day), monthOf(word ?? ''), undefined, publishedOn))
        found.add(night);
  for (const [, day, word, year] of text.matchAll(WORD_DAY)) {
    const month = monthOf(word ?? '');
    if (month !== null) found.add(dayText(Number(year), month, Number(day)));
  }
  for (const [, word, day, year] of text.matchAll(WORD_MONTH_FIRST)) {
    const month = monthOf(word ?? '');
    if (month !== null) found.add(dayText(Number(year), month, Number(day)));
  }
  for (const [, first = '', mark = '', second = '', third = ''] of text.matchAll(NUMERIC_DAY))
    for (const day of numericDays(first, mark, second, third, dayFirst)) found.add(day);
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

const stated = (value: Scalar, passage: string, options: DayOptions): boolean => {
  if (typeof value === 'boolean') {
    const words = wordsOf(passage);
    return YES_NO[value ? 'true' : 'false'].some((word) => words.includes(word));
  }
  if (typeof value === 'number')
    return (value < 0 ? negativesIn(passage) : numbersIn(passage)).some((found) =>
      sameNumber(found, value),
    );
  if (DAY.test(value) && daysIn(passage, options).has(value)) return true;
  if (statesWords(value, passage)) return true;
  if (statesToken(value, passage)) return true;
  const asNumber = readingsOf(value);
  return (
    /^[\d\s,.'\u00A0\u202F-]+$/u.test(value) &&
    asNumber.some((reading) => numbersIn(passage).some((found) => sameNumber(found, reading)))
  );
};

// The kind and the precision of an event are words of a closed list, and a page never states them
// in that form.
const WORDS_OF_A_LIST: readonly string[] = [EVENT_KIND, EVENT_PRECISION];

const attributeValues = (
  attrs: Readonly<Record<string, { readonly v: unknown }>> | undefined,
  skipped: readonly string[] = [],
): ActValue[] =>
  Object.entries(attrs ?? {})
    .filter(([key]) => !skipped.includes(key))
    .flatMap(([key, held]) =>
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
      // The name of an event has a fixed form that the tool checks, and no page states it.
      return [
        ...(act.type === 'event' ? [] : [{ name: 'label', value: act.label }]),
        ...attributeValues(act.attrs, act.type === 'event' ? WORDS_OF_A_LIST : []),
      ];
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

const JURISDICTION_KEY = 'registration_jurisdiction';

// The spellings of a registration jurisdiction in the sources, by ISO 3166-1 code. The record
// holds the code. A source writes the name, so the code is stated by any of its spellings.
export const JURISDICTION_SPELLINGS: Readonly<Record<string, readonly string[]>> = {
  RU: ['RU', 'Russia', 'Russian Federation', 'Россия', 'Российская Федерация', 'РФ'],
};

const jurisdictionCode = (value: Scalar): string | null => {
  if (typeof value !== 'string') return null;
  const wanted = plainText(value).trim();
  return (
    Object.entries(JURISDICTION_SPELLINGS).find(([, names]) =>
      names.some((name) => plainText(name) === wanted),
    )?.[0] ?? null
  );
};

/** The value of an identifier as the record holds it: a registration jurisdiction with a known
 * spelling is its ISO 3166-1 code, and each other value stays as it is. */
export const codedIdentifier = (key: string, value: string): string =>
  key === JURISDICTION_KEY ? (jurisdictionCode(value) ?? value) : value;

/** The act with each registration jurisdiction of an entity that has a known spelling written as
 * its ISO 3166-1 code, so "Russia" and "Russian Federation" become "RU". The cited passage keeps
 * the text of the source. A jurisdiction with no known spelling stays as it is, and a list keeps
 * each code once, in its first place. */
export const withCodedJurisdiction = <Act extends { readonly op: string }>(act: Act): Act => {
  if (act.op !== 'create_entity' && act.op !== 'update_attrs') return act;
  const { attrs, targetKind } = act as {
    readonly attrs?: Readonly<Record<string, { readonly v: unknown }>>;
    readonly targetKind?: string;
  };
  if (targetKind === 'relation') return act;
  const held = attrs?.[JURISDICTION_KEY];
  if (attrs === undefined || held === undefined) return act;
  const coded = (one: unknown): unknown =>
    typeof one === 'string' ? (jurisdictionCode(one) ?? one) : one;
  const v = Array.isArray(held.v)
    ? held.v.map(coded).filter((one, index, all) => all.indexOf(one) === index)
    : coded(held.v);
  return { ...act, attrs: { ...attrs, [JURISDICTION_KEY]: { ...held, v } } };
};

const statesJurisdiction = (code: string, passage: string): boolean =>
  (JURISDICTION_SPELLINGS[code] ?? []).some((name) => statesToken(name, passage));

/** The days of an act that a cited passage states only through the publication day: the passage
 * writes no year, and the year comes from the day of publication. */
export const daysFromPublication = (
  act: WriteRequest,
  passages: readonly string[],
  publishedOn: string | undefined,
  dayFirst = false,
): string[] => {
  if (publishedOn === undefined) return [];
  const text = passages.join('\n');
  const nightEvent = isNightEvent(act);
  const alone = daysIn(text, { dayFirst, nightEvent });
  const deduced = daysIn(text, { publishedOn, dayFirst, nightEvent });
  return [
    ...new Set(
      [
        ...valuesOf(act),
        ...(act.op === 'update_relation' && act.validFrom !== undefined
          ? [{ name: 'validFrom', value: act.validFrom }]
          : []),
        ...(act.op === 'update_relation' && act.validTo !== undefined
          ? [{ name: 'validTo', value: act.validTo }]
          : []),
      ].flatMap(({ value }) =>
        typeof value === 'string' && deduced.has(value) && !alone.has(value) ? [value] : [],
      ),
    ),
  ];
};

// Origin: decided. A source rounds a decimal degree, and UN/LOCODE writes whole minutes, so a
// coordinate is stated when the text holds it to within one minute of arc.
const COORDINATE_TOLERANCE = 1 / 60;

// Each coordinate that a text writes, as a degree with no sign: a decimal degree (59.6667), the
// degrees and minutes of UN/LOCODE (5940N, 02819E), and degrees and minutes with signs (59°40′).
// shortcut: the hemisphere is not read, so 59.6 S states 59.6 N; read the letter when a source
// south of the equator or west of Greenwich is cited.
const coordinatesIn = (text: string): number[] => [
  // A decimal point can follow a CSV comma (Oblast,60.5233,28.1301), but a decimal comma cannot.
  // shortcut: a thousands comma (1,059.40) also gives 59.4; refuse it when a cited price or
  // tonnage states a false coordinate.
  ...Array.from(text.matchAll(/(?<![\d.])(\d{1,3})\.(\d+)/gu), (one) =>
    Number(`${one[1] ?? ''}.${one[2] ?? ''}`),
  ),
  ...Array.from(text.matchAll(/(?<![\d.,])(\d{1,3}),(\d+)/gu), (one) =>
    Number(`${one[1] ?? ''}.${one[2] ?? ''}`),
  ),
  ...Array.from(
    text.matchAll(/(?<!\d)(\d{2,3})(\d{2})\s?[NSEW]\b/gu),
    (one) => Number(one[1]) + Number(one[2]) / 60,
  ),
  ...Array.from(
    text.matchAll(/(?<!\d)(\d{1,3})\s*°\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*['′])?/gu),
    (one) => Number(one[1]) + Number((one[2] ?? '0').replace(',', '.')) / 60,
  ),
];

// The place that an act gives: the two coordinates of a point. Code reads no other shape in a
// text, so another shape is unstated, and the operator compares it with the page.
const placeValues = (act: WriteRequest): ActValue[] => {
  if (act.op !== 'update_entity' || act.geom === undefined) return [];
  if (act.geom.type !== 'Point') return [{ name: 'geom', value: act.geom.type }];
  const [lon = Number.NaN, lat = Number.NaN] = act.geom.coordinates;
  return [
    { name: 'geom.longitude', value: lon },
    { name: 'geom.latitude', value: lat },
  ];
};

const statesCoordinate = (value: Scalar, coordinates: readonly number[]): boolean =>
  typeof value === 'number' &&
  coordinates.some((one) => Math.abs(one - Math.abs(value)) <= COORDINATE_TOLERANCE);

/** The values of an act that no cited passage states, in any form of that value. */
export const unstatedValues = (
  act: WriteRequest,
  passages: readonly string[],
  options: StatedOptions = {},
): ActValue[] => {
  const text = passages.join('\n');
  const coordinates = coordinatesIn(text);
  return [
    ...valuesOf(act).filter((named) => {
      const code =
        named.name === `attrs.${JURISDICTION_KEY}` ? jurisdictionCode(named.value) : null;
      if (code !== null && statesJurisdiction(code, text)) return false;
      return !stated(named.value, text, { ...options, nightEvent: isNightEvent(act) });
    }),
    ...placeValues(act).filter((named) => !statesCoordinate(named.value, coordinates)),
  ];
};

/** The name of a bound of a relation. */
export type BoundName = 'validFrom' | 'validTo';

/** The act with no value for each bound that `dropped` names. */
export const withoutBounds = <
  Act extends { validFrom?: string | undefined; validTo?: string | undefined },
>(
  act: Act,
  dropped: readonly DroppedName[],
): Act => {
  const kept = { ...act };
  if (dropped.includes('validFrom')) delete kept.validFrom;
  if (dropped.includes('validTo')) delete kept.validTo;
  return kept;
};

/** The name of a value of an act that code removes when no passage states it. */
export type DroppedName = BoundName | 'observed_on';

/** The relation types of a port call. The claim key of a relation holds the same list. */
export const PORT_CALL_TYPES = ['berthed_at', 'loads_at', 'discharges_at'] as const;

// The day of a port call, when the act is a port call that gives one.
const callDayOf = (act: WriteRequest): { readonly v: unknown } | undefined =>
  act.op === 'create_relation' && PORT_CALL_TYPES.some((type) => type === act.type)
    ? act.attrs?.['observed_on']
    : undefined;

/** Is the day of a port call no single real day that a cited passage states? The day enters the
 * claim key of the call, so a guessed day, a month or a list would make a false second fact. */
export const unstatedCallDay = (
  act: WriteRequest,
  passages: readonly string[],
  options: StatedOptions = {},
): boolean => {
  const held = callDayOf(act);
  if (held === undefined) return false;
  const day = held.v;
  const parts = typeof day === 'string' ? DAY.exec(day) : null;
  if (typeof day !== 'string' || parts === null) return true;
  const [, year = '', month = '', date = ''] = parts;
  return !(
    isRealDay(Number(year), Number(month), Number(date)) &&
    daysIn(passages.join('\n'), options).has(day)
  );
};

/** The act with no day of a call, and no attributes when the day was the only one. */
export const withoutCallDay = <
  Act extends { readonly op: string; attrs?: Readonly<Record<string, unknown>> | undefined },
>(
  act: Act,
): Act => {
  const others = Object.entries(act.attrs ?? {}).filter(([key]) => key !== 'observed_on');
  const kept = { ...act };
  if (others.length === 0) delete kept.attrs;
  else Object.assign(kept, { attrs: Object.fromEntries(others) });
  return kept;
};

/** A passage names a provision when it names a directive, an annex or an article by its number.
 * A type change of a relation rests on that provision. */
export const namesProvision = (passages: readonly string[]): boolean =>
  /\b(directive\s+\d+|annex\s+(?:[ivxlc]+|\d+)\b|articles?\s+\d+)/i.test(passages.join('\n'));

/** The two bounds of a relation. Each one is a day that a cited passage states, or it is not
 * proposed: a bound that no passage states is removed from the act, and `dropped` names it. The
 * other values of the act stay, and an unstated one marks the item as disputed. The start or the
 * end that an act gives to a relation of the record is the whole act, so it stays, and `dropped`
 * names it. */
export const statedBounds = (
  act: WriteRequest,
  passages: readonly string[],
  options: StatedOptions = {},
): { readonly act: WriteRequest; readonly dropped: BoundName[] } => {
  const text = passages.join('\n');
  if (act.op !== 'create_relation' && act.op !== 'update_relation') return { act, dropped: [] };
  const dropped = (['validFrom', 'validTo'] as const).filter((name) => {
    const day = act[name];
    return day !== undefined && !stated(day, text, options);
  });
  return { act: act.op === 'update_relation' ? act : withoutBounds(act, dropped), dropped };
};
