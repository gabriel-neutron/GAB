// The text of a stored file, as a list of pages. The function is pure: it reads no database and no
// object store, and it calls no model. A reader must treat an empty page as a page, because a PDF
// page with no text layer is empty and nothing here reads an image of it.

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';
import { extractText as readPdf, getDocumentProxy } from 'unpdf';

export interface Extracted {
  readonly pages: readonly string[];
}

export class UnsupportedTypeError extends Error {
  constructor(mime: string) {
    super(`no text is read from the type ${mime}`);
    this.name = 'UnsupportedTypeError';
  }
}

// External constraint: PostgreSQL text refuses U+0000, and a PDF string can carry it, so the
// character is removed before a page can reach the door.
const withoutNul = (text: string): string => text.replaceAll('\u0000', '');

const PLAIN = new Set(['text/plain', 'text/markdown', 'text/csv']);

const pdfPages = async (bytes: Uint8Array): Promise<string[]> => {
  // External constraint: unpdf hands the buffer to a worker that may detach it, so it gets a copy.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await readPdf(pdf, { mergePages: false });
  return text.map(withoutNul);
};

// A reader comment kept in the text would read as a sentence of the page. Readability keeps a
// comment block inside the article, and it is not asked at all for a page with no article, so
// the cut comes before both roads.
const COMMENTS = [
  '#comments',
  '#disqus_thread',
  '.comments',
  '.comment',
  '.comment-list',
  '.comment-body',
  '[itemprop~="comment"]',
  '[itemtype$="/Comment"]',
  '[itemtype$="/UserComments"]',
].join(', ');

const oneLine = (text: string): string => text.replaceAll(/\s*\n+\s*/gu, ' ').trim();

// A bar in the text of a cell would read as the edge of one more cell, so it is escaped.
const cellText = (text: string): string => oneLine(text).replaceAll('|', String.raw`\|`);

// Departure: Turndown writes a table cell as a paragraph of its own, so an empty cell vanishes
// and the row that a cell belongs to is lost. A row is one line here, and a cell is kept even
// when it is empty, so the second row cannot slide into the place of the first.
interface Attributed {
  getAttribute(name: string): string | null;
}

const columnsOf = (node: Attributed): number => {
  const span = Number(node.getAttribute('colspan'));
  return Number.isInteger(span) && span > 1 ? Math.min(span, 100) : 1;
};

const STRUCK: ReadonlySet<string> = new Set(['DEL', 'S', 'STRIKE']);

const readable = (): TurndownService => {
  const turndown = new TurndownService({ headingStyle: 'atx' });
  turndown.addRule('cell', {
    filter: ['th', 'td'],
    replacement: (content, node) => `| ${cellText(content)} ${'|  '.repeat(columnsOf(node) - 1)}`,
  });
  turndown.addRule('row', { filter: 'tr', replacement: (content) => `${content}|\n` });
  turndown.addRule('table', {
    filter: ['table', 'thead', 'tbody', 'tfoot'],
    replacement: (content) => `\n\n${content}\n\n`,
  });
  // A struck sentence is a retraction or an edit. Printed as plain text it states what the page
  // took back, and dropped it hides that the page ever said it.
  turndown.addRule('struck', {
    filter: (node) => STRUCK.has(node.nodeName),
    replacement: (content) => (content.trim() === '' ? '' : `~~${content}~~`),
  });
  return turndown;
};

// An XHTML document of the Publications Office is one act with no navigation, and Readability keeps
// only one part of it (an annex). Thus the whole document is the text of an XHTML answer.
const htmlPage = (bytes: Uint8Array, whole: boolean): string => {
  const source = new TextDecoder('utf-8').decode(bytes);
  const { document } = parseHTML(source);
  document.querySelectorAll(COMMENTS).forEach((comment: { remove(): void }) => {
    comment.remove();
  });
  // Readability finds nothing in a page with no article, and the whole body is then the text.
  const article = whole ? null : new Readability(document).parse();
  const html = article?.content ?? document.documentElement.outerHTML;
  return withoutNul(readable().turndown(html).trim());
};

export const extractText = async (bytes: Uint8Array, mime: string): Promise<Extracted> => {
  const type = (mime.split(';')[0] ?? '').trim().toLowerCase();
  if (type === 'application/pdf') return { pages: await pdfPages(bytes) };
  if (type === 'text/html') return { pages: [htmlPage(bytes, false)] };
  // XHTML is HTML written as XML. The Publications Office of the EU gives the official text of an
  // act in it.
  if (type === 'application/xhtml+xml') return { pages: [htmlPage(bytes, true)] };
  if (PLAIN.has(type)) return { pages: [withoutNul(new TextDecoder('utf-8').decode(bytes))] };
  throw new UnsupportedTypeError(mime);
};
