// A document needs a title that a reader understands. A page gives its heading, and a PDF with no
// title gives its first line. An address or a file path is no title, so such a title is replaced
// by the first line of the text when there is one.

const MAX_LINE = 200;
const SCANNED_LINES = 30;
const NOTE = /\s+\([^()]*\)$/u;

/** The note at the end of a title, such as "(saved by the browser)" or "(in archive.zip)". */
const noteOf = (title: string): string => NOTE.exec(title)?.[0] ?? '';

/** True when the title is empty, an address, or the path or the name of a file. */
export const isWeakTitle = (title: string): boolean => {
  const core = title.replace(NOTE, '').trim();
  if (core === '') return true;
  if (/\s/u.test(core)) return false;
  return (
    /^[a-z][a-z0-9+.-]*:\/\//iu.test(core) || /[/\\]/u.test(core) || /\.[a-z0-9]{2,5}$/iu.test(core)
  );
};

const cutAtWord = (line: string): string => {
  if (line.length <= MAX_LINE) return line;
  const cut = line.slice(0, MAX_LINE);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : cut).trim();
};

/** The first line of the text that can be a heading: it holds two letters in a row, so a page
 * number or a date alone is not one. It is null when the text has none. */
export const firstLine = (pages: readonly string[]): string | null => {
  const lines = (pages[0] ?? '').split(/\r?\n/u).slice(0, SCANNED_LINES);
  for (const line of lines) {
    const text = line.replace(/\s+/gu, ' ').trim();
    if (/\p{L}{2}/u.test(text)) return cutAtWord(text);
  }
  return null;
};

/** The title that a reader understands: the given title when it is readable, else the first line
 * of the text with the note of the given title, else the given title. */
export const readableTitle = (title: string, pages: readonly string[]): string => {
  if (!isWeakTitle(title)) return title;
  const line = firstLine(pages);
  return line === null ? title : `${line}${noteOf(title)}`;
};
