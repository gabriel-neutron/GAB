// The text of a stored file, as a list of pages, and the name of the extractor that made them. The
// function is pure: it reads no database and no object store, and it calls no model. A reader must
// treat an empty page as a page, because a PDF page with no text layer is empty.

import { extractText as readPdf, getDocumentProxy } from 'unpdf';

import { liveText } from './live-text.ts';
import { OCR_EXTRACTOR, ocrPage } from './ocr.ts';

export { HIDDEN } from './live-text.ts';
export { OCR_EXTRACTOR } from './ocr.ts';

/** The text set of a PDF and of a plain file. */
export const TEXT_EXTRACTOR = 'text-1';

/** The text set of an HTML page: its live text, with each hidden code point as a placeholder. */
export const HTML_EXTRACTOR = 'html-live-1';

export interface Extracted {
  readonly pages: readonly string[];
  /** The name of the text set. Two extractors of one document give two sets, never one. */
  readonly extractor: string;
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

// An XML act is read as its text, so the offsets of a parser are offsets of the stored page.
const PLAIN = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/xml', 'text/xml']);

const pdfPages = async (bytes: Uint8Array): Promise<string[]> => {
  // External constraint: unpdf hands the buffer to a worker that may detach it, so it gets a copy.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await readPdf(pdf, { mergePages: false });
  return text.map(withoutNul);
};

const htmlPage = (bytes: Uint8Array): string =>
  withoutNul(liveText(new TextDecoder('utf-8').decode(bytes)));

export const extractText = async (bytes: Uint8Array, mime: string): Promise<Extracted> => {
  const type = (mime.split(';')[0] ?? '').trim().toLowerCase();
  if (type === 'application/pdf')
    return { pages: await pdfPages(bytes), extractor: TEXT_EXTRACTOR };
  if (type === 'text/html') return { pages: [htmlPage(bytes)], extractor: HTML_EXTRACTOR };
  if (PLAIN.has(type))
    return {
      pages: [withoutNul(new TextDecoder('utf-8').decode(bytes))],
      extractor: TEXT_EXTRACTOR,
    };
  if (type.startsWith('image/')) return { pages: [await ocrPage(bytes)], extractor: OCR_EXTRACTOR };
  throw new UnsupportedTypeError(mime);
};
