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

const htmlPage = (bytes: Uint8Array): string => {
  const source = new TextDecoder('utf-8').decode(bytes);
  const { document } = parseHTML(source);
  // Readability finds nothing in a page with no article, and the whole body is then the text.
  const article = new Readability(document).parse();
  const html = article?.content ?? document.documentElement.outerHTML;
  return withoutNul(new TurndownService({ headingStyle: 'atx' }).turndown(html).trim());
};

export const extractText = async (bytes: Uint8Array, mime: string): Promise<Extracted> => {
  const type = (mime.split(';')[0] ?? '').trim().toLowerCase();
  if (type === 'application/pdf') return { pages: await pdfPages(bytes) };
  if (type === 'text/html') return { pages: [htmlPage(bytes)] };
  if (PLAIN.has(type)) return { pages: [withoutNul(new TextDecoder('utf-8').decode(bytes))] };
  throw new UnsupportedTypeError(mime);
};
