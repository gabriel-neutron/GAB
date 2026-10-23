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

// The legal forms of a company, in Russian (as the table writes them) and in English, short and
// in full. Each form is folded as a name is, so the spelling of another table matches too.
const LEGAL_FORMS: readonly string[] = [
  'obshchestvo s ogranichennoi otvetstvennostiu',
  'publichnoe aktsionernoe obshchestvo',
  'nepublichnoe aktsionernoe obshchestvo',
  'zakrytoe aktsionernoe obshchestvo',
  'otkrytoe aktsionernoe obshchestvo',
  'aktsionernoe obshchestvo',
  'federalnoe gosudarstvennoe unitarnoe predpriiatie',
  'gosudarstvennoe unitarnoe predpriiatie',
  'munitsipalnoe unitarnoe predpriiatie',
  'individualnyi predprinimatel',
  'public joint stock company',
  'closed joint stock company',
  'open joint stock company',
  'joint stock company',
  'limited liability company',
  'company limited',
  'ooo',
  'oao',
  'pao',
  'zao',
  'ao',
  'nao',
  'ip',
  'fgup',
  'gup',
  'mup',
  'llc',
  'ojsc',
  'pjsc',
  'cjsc',
  'jsc',
  'ltd',
  'limited',
  'plc',
  'inc',
  'incorporated',
  'company',
];

// A key this short matches too many names to be a candidate.
const SHORTEST_KEY = 3;

// The script of a name is the script of most of its letters. A name with less than this share in
// one script is in both: one stray letter of the other script does not change the script.
const SCRIPT_SHARE = 2 / 3;

const folded = (word: string): string =>
  VARIANTS.reduce((text, [pattern, form]) => text.replace(pattern, form), word);

const latinOf = (word: string): string =>
  folded(
    Array.from(word, (letter) => ICAO_9303[letter] ?? letter)
      .join('')
      .normalize('NFKD')
      .replace(/\p{M}/gu, ''),
  );

// The forms as lists of folded words, the longest first, so a full form wins over its tail.
const FORMS: readonly (readonly string[])[] = LEGAL_FORMS.map((form) =>
  form.split(' ').map(latinOf),
).sort((a, b) => b.length - a.length);

/** The script of a name, from its letters: Latin, Cyrillic, both, or none. */
export type Script = 'latin' | 'cyrillic' | 'mixed' | 'none';

/** What the comparison reads in one name. */
export interface NameReading {
  /** The name in lower case and in Latin letters, with no legal form, no punctuation and one form
   * for each letter that has variants. Null when fewer than three letters or digits are left. */
  readonly key: string | null;
  /** The script of the letters of the name, legal form apart. */
  readonly script: Script;
}

const scriptOf = (words: readonly string[]): Script => {
  const text = words.join('');
  const latin = text.match(/\p{Script=Latin}/gu)?.length ?? 0;
  const cyrillic = text.match(/\p{Script=Cyrillic}/gu)?.length ?? 0;
  const letters = latin + cyrillic;
  if (letters === 0) return 'none';
  if (latin >= letters * SCRIPT_SHARE) return 'latin';
  return cyrillic >= letters * SCRIPT_SHARE ? 'cyrillic' : 'mixed';
};

const startsWith = (words: readonly string[], at: number, form: readonly string[]): boolean =>
  form.every((word, offset) => words[at + offset] === word);

/** Reads the key and the script of one name. `sortWords` puts the words of the key in order, for
 * a person whose names can come in any order. */
export const readName = (
  name: string,
  { sortWords = false }: { readonly sortWords?: boolean } = {},
): NameReading => {
  const words = name
    .normalize('NFC')
    .toLowerCase()
    .replace(/['’ʹʺ`]/gu, '')
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .map((word) => ({ word, latin: latinOf(word) }))
    .filter((one) => one.latin !== '');
  const latin = words.map((one) => one.latin);
  const kept: typeof words = [];
  for (let at = 0; at < words.length;) {
    const form = FORMS.find((one) => startsWith(latin, at, one));
    if (form === undefined) {
      const one = words[at];
      if (one !== undefined) kept.push(one);
      at += 1;
    } else at += form.length;
  }
  const keyWords = kept.map((one) => one.latin);
  if (sortWords) keyWords.sort();
  const key = keyWords.join(' ');
  return {
    key: key.replaceAll(' ', '').length < SHORTEST_KEY ? null : key,
    script: scriptOf(kept.map((one) => one.word)),
  };
};
