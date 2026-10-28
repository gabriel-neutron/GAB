/** A part of a page, in code points of the stored text: the first one, and one after the last. */
export interface Span {
  readonly start: number;
  readonly end: number;
}

const SOFT_HYPHEN = '\u00AD';

// A model copies a quote with the quotes and the dashes of its keyboard, and a PDF keeps the
// typographic ones. Each one is read as its plain form.
const PLAIN: Readonly<Record<string, string>> = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201A': "'",
  '\u201B': "'",
  '\u2032': "'",
  '\u201C': '"',
  '\u201D': '"',
  '\u201E': '"',
  '\u201F': '"',
  '\u2033': '"',
  '\u2010': '-',
  '\u2011': '-',
  '\u2012': '-',
  '\u2013': '-',
  '\u2014': '-',
  '\u2015': '-',
  '\u2212': '-',
};

const HYPHENS = new Set(['-', '\u2010', '\u2011']);

const isSpace = (point: string | undefined): boolean => point !== undefined && /\s/u.test(point);

const isLetter = (point: string | undefined): boolean =>
  point !== undefined && /\p{L}/u.test(point);

const isLineEnd = (point: string | undefined): boolean => point === '\n' || point === '\r';

/** One text in the form that two copies of one passage share, and for each code point of it the
 * code point of the source that it came from. */
interface Folded {
  readonly text: string;
  readonly origin: readonly number[];
}

// The index after a hyphen inside a word, or -1. A PDF cuts "Ros-\nneft" and "state-\nowned" at
// a line end, and a model writes "Rosneft" and "state-owned". So a hyphen between two letters
// goes, with the line end after it, and each of the three forms reads the same.
const afterWordHyphen = (points: readonly string[], at: number): number => {
  if (!HYPHENS.has(points[at] ?? '') || !isLetter(points[at - 1])) return -1;
  let next = at + 1;
  if (isLetter(points[next])) return next;
  while (isSpace(points[next]) && !isLineEnd(points[next])) next += 1;
  if (!isLineEnd(points[next])) return -1;
  while (isSpace(points[next])) next += 1;
  return isLetter(points[next]) ? next : -1;
};

/** White space, the Unicode compatibility forms, the soft hyphens and the hyphens inside a word
 * are made the same. The case stays: an excerpt is verbatim. */
export const fold = (source: string): Folded => {
  const points = Array.from(source);
  const out: string[] = [];
  const origin: number[] = [];
  let at = 0;
  while (at < points.length) {
    const point = points[at] ?? '';
    const joined = afterWordHyphen(points, at);
    if (joined !== -1) {
      at = joined;
      continue;
    }
    if (isSpace(point)) {
      if (out.length > 0 && out.at(-1) !== ' ') {
        out.push(' ');
        origin.push(at);
      }
      at += 1;
      continue;
    }
    if (point !== SOFT_HYPHEN)
      for (const part of Array.from((PLAIN[point] ?? point).normalize('NFKD'))) {
        out.push(part);
        origin.push(at);
      }
    at += 1;
  }
  if (out.at(-1) === ' ') {
    out.pop();
    origin.pop();
  }
  return { text: out.join(''), origin };
};

const isHigh = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;

// A string index counts UTF-16 units, and a span counts code points. The two loops below read the
// text in place: an array of its code points would hold millions of strings for a long page.
const pointIndex = (text: string, unit: number): number => {
  let points = 0;
  for (let at = 0; at < unit; at += 1) {
    const paired = isLow(text.charCodeAt(at)) && at > 0 && isHigh(text.charCodeAt(at - 1));
    if (!paired) points += 1;
  }
  return points;
};

// The index of the unit where the code point number `point` starts. A point past the end of the
// text gives the end of the text.
const unitIndex = (text: string, point: number): number => {
  let at = 0;
  for (let seen = 0; seen < point && at < text.length; seen += 1)
    at += isHigh(text.charCodeAt(at)) && isLow(text.charCodeAt(at + 1)) ? 2 : 1;
  return at;
};

/** The part of a text between two code points, as a span counts them. */
export const pointSlice = (text: string, start: number, end: number): string =>
  text.slice(unitIndex(text, start), unitIndex(text, end));

/** The most UTF-16 units of a page that the fold reads at one time. Origin: decided, not
 * calibrated. The fold makes arrays of about 64 bytes for each character, so this size holds its
 * memory near 64 MiB. A longer page is read in windows that overlap by more than an excerpt. */
export const MAX_TOLERANT_UNITS = 1024 * 1024;

// The span of the folded excerpt in one window of the page, in code points of the window.
const foldedIn = (window: string, wanted: string): Span | null => {
  const folded = fold(window);
  // A match that stops before an accent of the page stops inside a letter: "cafe" is not "café".
  let found = folded.text.indexOf(wanted);
  while (found !== -1 && /^\p{M}/u.test(folded.text.slice(found + wanted.length)))
    found = folded.text.indexOf(wanted, found + 1);
  if (found === -1) return null;
  const first = pointIndex(folded.text, found);
  const last = first + pointIndex(wanted, wanted.length) - 1;
  const start = folded.origin[first];
  const end = folded.origin[last];
  if (start === undefined || end === undefined) return null;
  return { start, end: end + 1 };
};

/** Where a page holds an excerpt: the exact text first, then the folded text, window by window.
 * Null when the page does not hold it. */
export const findExcerpt = (page: string, excerpt: string): Span | null => {
  const exact = excerpt === '' ? -1 : page.indexOf(excerpt);
  if (exact !== -1) {
    const start = pointIndex(page, exact);
    return { start, end: start + pointIndex(excerpt, excerpt.length) };
  }
  const wanted = fold(excerpt).text;
  if (wanted === '') return null;
  // shortcut: a run of white space longer than the overlap, between two words of the excerpt,
  // hides the excerpt at a window edge; upgrade when a page shows it.
  const overlap = Math.max(4 * excerpt.length, 4096);
  const size = MAX_TOLERANT_UNITS + overlap;
  for (let from = 0; ; from += MAX_TOLERANT_UNITS) {
    // A window never starts inside a surrogate pair.
    const begin = isLow(page.charCodeAt(from)) ? from + 1 : from;
    const span = foldedIn(page.slice(begin, begin + size), wanted);
    if (span !== null) {
      const base = pointIndex(page, begin);
      return { start: base + span.start, end: base + span.end };
    }
    if (begin + size >= page.length) return null;
  }
};
