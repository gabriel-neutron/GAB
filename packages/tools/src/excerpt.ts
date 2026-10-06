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

const codePoints = (text: string): number => Array.from(text).length;

// A string index counts UTF-16 units, and a span counts code points.
const pointIndex = (text: string, unit: number): number => codePoints(text.slice(0, unit));

/** Where a page holds an excerpt: the exact text first, then the folded text. Null when the page
 * does not hold it. */
export const findExcerpt = (page: string, excerpt: string): Span | null => {
  const exact = excerpt === '' ? -1 : page.indexOf(excerpt);
  if (exact !== -1) {
    const start = pointIndex(page, exact);
    return { start, end: start + codePoints(excerpt) };
  }

  const folded = fold(page);
  const wanted = fold(excerpt).text;
  if (wanted === '') return null;
  // A match that stops before an accent of the page stops inside a letter: "cafe" is not "café".
  let found = folded.text.indexOf(wanted);
  while (found !== -1 && /^\p{M}/u.test(folded.text.slice(found + wanted.length)))
    found = folded.text.indexOf(wanted, found + 1);
  if (found === -1) return null;
  const first = pointIndex(folded.text, found);
  const last = first + codePoints(wanted) - 1;
  const start = folded.origin[first];
  const end = folded.origin[last];
  if (start === undefined || end === undefined) return null;
  return { start, end: end + 1 };
};
