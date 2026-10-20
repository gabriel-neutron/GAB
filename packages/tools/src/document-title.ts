// A document needs a title that a reader understands. A page gives its heading, and a PDF with no
// title gives its first line. An address or a file path is no title, so such a title is replaced
// by the first line of the text. When the text has no usable line, the title becomes the name of
// the file with no extension, else the host of the address.

import { hostOf } from './document-type.ts';

const MAX_LINE = 200;
const SCANNED_LINES = 30;
const NOTE = /\s+\([^()]*\)$/u;

// External constraint: the extensions of the files that the tools store or that a browser saves.
const FILE_END =
  /\.(?:pdf|html?|xhtml|png|jpe?g|json|geojson|tsv|txt|xml|csv|md|zip|docx?|xlsx?)$/iu;

/** The note at the end of a title, such as "(saved by the browser)" or "(in archive.zip)". */
const noteOf = (title: string): string => NOTE.exec(title)?.[0] ?? '';

/** True when the title is empty, an address, or a file path or a file name. A title with spaces
 * can be one too: a path that starts at the root, or a name that ends with a file extension. */
export const isWeakTitle = (title: string): boolean => {
  const core = title.replace(NOTE, '').trim();
  if (core === '') return true;
  if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(core)) return true;
  if (/^(?:[/\\]|[a-z]:[/\\])/iu.test(core)) return true;
  if (FILE_END.test(core)) return true;
  return !/\s/u.test(core) && /[/\\]/u.test(core);
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

// The last part of a path, with no extension and no query. A part that is not valid percent
// encoding stays as it is.
const nameOf = (path: string): string | null => {
  const last =
    path
      .split(/[/\\]/u)
      .filter((part) => part !== '')
      .pop() ?? '';
  let name = last.split(/[?#]/u)[0] ?? '';
  try {
    name = decodeURIComponent(name);
  } catch {
    // A part with a bad sequence stays as written.
  }
  name = name.replace(FILE_END, '').replace(/[_-]+/gu, ' ').trim();
  return /\p{L}{2}/u.test(name) ? name : null;
};

/** The name of the file with no extension, else the host, else null. */
const fallbackOf = (core: string, uri: string | null): string | null => {
  const parsed = uri === null ? null : URL.parse(uri);
  const fromTitle = /^[a-z][a-z0-9+.-]*:\/\//iu.test(core) ? URL.parse(core)?.pathname : core;
  return (
    nameOf(fromTitle ?? '') ??
    nameOf(parsed?.pathname ?? '') ??
    hostOf(uri) ??
    (/\s/u.test(core) || /^[/\\]/u.test(core) ? null : hostOf(`https://${core}`))
  );
};

/** The title that a reader understands: the given title when it is readable, else the first line
 * of the text, else the name of the file or the host, each with the note of the given title. The
 * given title stays only when nothing else can be read from it. */
export const readableTitle = (
  title: string,
  pages: readonly string[],
  uri: string | null = null,
): string => {
  if (!isWeakTitle(title)) return title;
  const chosen = firstLine(pages) ?? fallbackOf(title.replace(NOTE, '').trim(), uri);
  return chosen === null ? title : `${chosen}${noteOf(title)}`;
};
