// Personal data leaves a prompt before each model call, unless the task of the call needs it.
// Each removed code point becomes one `#`, so the offsets of a reader point at the same characters
// of the untouched page, where code checks each span. No offset map is needed.

import { PERSONAL_KEYS, type PersonalKey } from '@gab/tools/personal';

/** The version of the minimiser. A call record names it, and a new rule is a new version. */
export const MINIMISER_VERSION = 'minimiser-1';

/** What a reader runs on each text before a model reads it, with the version that the call record
 * names. */
export interface Minimiser {
  readonly version: string;
  readonly apply: (text: string) => string;
}

const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|' +
  'января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря|' +
  'січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня';

const DATE = `(\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4})`;

// Each rule finds the value after a cue word, and only the value is removed: the cue tells a
// reader that a value stood there, and it is no personal data. The lists are small, in the three
// languages of the word lists, and a larger list is a new version.
const RULES: readonly (readonly [PersonalKey, RegExp])[] = [
  [
    'date_of_birth',
    new RegExp(
      `(?:\\bborn(?:\\s+on)?|date of birth|\\bd\\.?o\\.?b\\.?|дата рождения|родил(?:ся|ась)|` +
        `дата народження|народився|народилася)[:\\s,]*${DATE}`,
      'giud',
    ),
  ],
  [
    'address',
    // An address ends at a full stop, a semicolon or a line end. The full stop of a street
    // abbreviation is part of the address.
    /(?:\baddress|residing at|lives at|адрес|проживает по адресу|адреса|проживає за адресою)[:\s]+((?:(?<!\p{L})(?:ул|вул|пр|просп|пер|д|кв|корп|стр|буд|г|м|с|st|ave|rd|apt)\.\s*|[^\n;.])+)/dgiu,
  ],
  [
    'identity_number',
    /(?:\bpassport(?:\s+(?:no\.?|number))?|паспорт(?:\s+серии)?|\bsnils|снилс|national id|id card|ипн|іпн|рнокпп)[:\s№#]*([A-ZА-Я0-9][A-ZА-Я0-9 -]{4,}[0-9])/dgiu,
  ],
  [
    'phone',
    /(?:\btel\.?|\bphone|телефон|тел\.?)[:\s]*(\+?\d[\d\s()-]{6,}\d)|(\+\d[\d\s()-]{8,}\d)/dgiu,
  ],
  ['email', /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/dgu],
];

interface Found {
  readonly key: PersonalKey;
  /** UTF-16 indices of the value, end excluded. */
  readonly start: number;
  readonly end: number;
}

/** Each personal value of a text, in the order of the rules. */
export const findPersonal = (text: string): Found[] => {
  const found: Found[] = [];
  for (const [key, rule] of RULES) {
    for (const match of text.matchAll(rule)) {
      const indices = match.indices;
      if (indices === undefined) continue;
      // The value is the first group that matched.
      const span = indices.slice(1).find((pair): pair is [number, number] => Array.isArray(pair));
      // A value that holds no letter and no digit is a placeholder that a minimiser wrote.
      if (span === undefined || !/[\p{L}\p{N}]/u.test(text.slice(span[0], span[1]))) continue;
      found.push({ key, start: span[0], end: span[1] });
    }
  }
  return found;
};

/** The categories of personal data that a text holds. */
export const personalCategories = (text: string): PersonalKey[] => {
  const keys = new Set(findPersonal(text).map((one) => one.key));
  return PERSONAL_KEYS.filter((key) => keys.has(key));
};

/** The text with each personal value outside `allowKeys` replaced by `#` of the same length in
 * code points, and the categories that were removed. */
export const minimiseForCall = (
  text: string,
  allowKeys: readonly PersonalKey[],
): { readonly text: string; readonly removed: readonly PersonalKey[] } => {
  const hidden = findPersonal(text).filter((one) => !allowKeys.includes(one.key));
  if (hidden.length === 0) return { text, removed: [] };
  const mask = new Array<boolean>(text.length).fill(false);
  for (const one of hidden) for (let at = one.start; at < one.end; at += 1) mask[at] = true;
  let out = '';
  let at = 0;
  // A code point outside the basic plane is two UTF-16 units and one `#`.
  for (const char of text) {
    out += mask[at] === true ? '#' : char;
    at += char.length;
  }
  const keys = new Set(hidden.map((one) => one.key));
  return { text: out, removed: PERSONAL_KEYS.filter((key) => keys.has(key)) };
};

/** The minimiser of every reader today: no task of a reader needs a personal key. */
export const READER_MINIMISER: Minimiser = {
  version: MINIMISER_VERSION,
  apply: (text) => minimiseForCall(text, []).text,
};
