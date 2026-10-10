// Departure: two exports, one job. The finder of the candidates asks the key of a name and its
// script, and the two read the same letters.

// Origin: the Russian table of ICAO Doc 9303 (part 3, seventh edition, 2015), which a Russian
// passport uses since 2014. One change: the key drops the hard sign, as the soft sign, because
// the other tables write it as an apostrophe or as nothing.
const ICAO_9303: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'iu',
  я: 'ia',
};

// The legal forms of a company, in Russian (as the table writes them) and in English. A name
// keeps its own words only.
const LEGAL_FORMS = new Set([
  'ooo',
  'oao',
  'pao',
  'zao',
  'ao',
  'nao',
  'ip',
  'llc',
  'ojsc',
  'pjsc',
  'cjsc',
  'jsc',
  'ltd',
  'plc',
  'inc',
]);

// The spellings that the other tables (BGN/PCGN, GOST 7.79, GOST 52535, the German and the old
// passport forms) give to one letter, folded to one form. The order is part of the rule: a fold
// that reads a letter comes before the fold that changes that letter.
const VARIANTS: readonly (readonly [RegExp, string])[] = [
  [/sch/gu, 'shch'],
  [/kh/gu, 'h'],
  [/t[zc](?!h)/gu, 'ts'],
  [/x/gu, 'ks'],
  [/w/gu, 'v'],
  [/[yj]u/gu, 'iu'],
  [/[yj]a/gu, 'ia'],
  [/[yj]e/gu, 'e'],
  [/c(?!h)/gu, 'k'],
  [/[yj]/gu, 'i'],
  [/(\p{L})\1+/gu, '$1'],
];

// A key this short matches too many names to be a candidate.
const SHORTEST_KEY = 3;

const transliterated = (name: string): string =>
  Array.from(name.toLowerCase(), (letter) => ICAO_9303[letter] ?? letter).join('');

const folded = (word: string): string =>
  VARIANTS.reduce((text, [pattern, form]) => text.replace(pattern, form), word);

/** The key that compares a Latin and a Cyrillic spelling of one name: the name in lower case and
 * in Latin letters, with no legal form, no punctuation and one form for each letter that has
 * variants. Null when fewer than three letters or digits are left. */
export const transliterationKey = (name: string): string | null => {
  const words = transliterated(name)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/['’ʹʺ`]/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '' && !LEGAL_FORMS.has(word))
    .map(folded);
  const key = words.join(' ');
  return key.replaceAll(' ', '').length < SHORTEST_KEY ? null : key;
};

/** The script of a name, from its letters: Latin, Cyrillic, both, or none. */
export type Script = 'latin' | 'cyrillic' | 'mixed' | 'none';

export const scriptOf = (name: string): Script => {
  const latin = /\p{Script=Latin}/u.test(name);
  const cyrillic = /\p{Script=Cyrillic}/u.test(name);
  if (latin && cyrillic) return 'mixed';
  if (latin) return 'latin';
  return cyrillic ? 'cyrillic' : 'none';
};
