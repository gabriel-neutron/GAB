// The text of a stored file, as a list of pages. The function is pure: it reads no database and no
// object store, and it calls no model. A reader must treat an empty page as a page, because a PDF
// page with no text layer is empty and nothing here reads an image of it. A PNG or a JPEG image is
// read by OCR, and its text is one page.

import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { createWorker, type Worker } from 'tesseract.js';
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

// The parts of a page that are no statement of it: code, the head, the frame of a site, and text
// that the page hides from a reader. The Readability road removes them itself; the whole road
// removes them here.
const FRAME = [
  'head',
  'script',
  'style',
  'noscript',
  'template',
  'nav',
  'header',
  'footer',
  'aside',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[hidden]',
  '[aria-hidden="true"]',
  '[style*="display:none" i]',
  '[style*="display: none" i]',
  '[style*="visibility:hidden" i]',
  '[style*="visibility: hidden" i]',
].join(', ');

// Readability keeps only one part of a long legal act: on Regulation (EU) 2022/879 it kept Annex IV
// alone. An XHTML answer is a document that a publisher builds as one whole text, as the official
// acts of the Publications Office of the EU, so it is read whole, without the frame of a site.
const htmlPage = (bytes: Uint8Array, whole: boolean): string => {
  const source = new TextDecoder('utf-8').decode(bytes);
  const { document } = parseHTML(source);
  document.querySelectorAll(COMMENTS).forEach((comment: { remove(): void }) => {
    comment.remove();
  });
  if (whole)
    document.querySelectorAll(FRAME).forEach((part: { remove(): void }) => {
      part.remove();
    });
  // Readability finds nothing in a page with no article, and the whole body is then the text.
  const article = whole ? null : new Readability(document).parse();
  const html = article?.content ?? document.documentElement.outerHTML;
  return withoutNul(readable().turndown(html).trim());
};

// External constraint: the types that extractText reads, by the extension that a file name holds.
// A name with another extension names no type, and the file is refused before any write.
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.pdf': 'application/pdf',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.xhtml': 'application/xhtml+xml',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/** The type that the extension of a file name names, or undefined when extractText reads none. */
export const mimeOfFileName = (name: string): string | undefined => {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? undefined : MIME_BY_EXTENSION[name.slice(dot).toLowerCase()];
};

// Ukrainian and Russian unit names stand next to English words in the same image.
const OCR_LANGUAGES = ['eng', 'ukr', 'rus'] as const;

// External constraint: tesseract.js reads every language from one folder, and each npm package of
// language data holds its file in a folder of its own. The files are copied into one temporary
// folder, so no language file comes from the network. A list of language objects would avoid the
// copy, but tesseract.js 7 then gives the bytes of the data in place of the language code.
const languageFolder = async (): Promise<string> => {
  const require = createRequire(import.meta.url);
  const folder = await mkdtemp(join(tmpdir(), 'gab-ocr-'));
  let copied = false;
  try {
    await Promise.all(
      OCR_LANGUAGES.map((code) => {
        const file = `${code}.traineddata.gz`;
        // The integer model is the one that tesseract.js itself takes for its LSTM engine.
        const source = join(
          dirname(require.resolve(`@tesseract.js-data/${code}`)),
          '4.0.0_best_int',
        );
        return copyFile(join(source, file), join(folder, file));
      }),
    );
    copied = true;
    return folder;
  } finally {
    if (!copied) await rm(folder, { recursive: true, force: true });
  }
};

interface Ocr {
  readonly worker: Worker;
  readonly folder: string;
}

// The OCR worker thread lives as long as the module uses it, because the language data takes a
// second to load. A caller that ends ends it too, or the thread holds the event loop open.
let ocr: Promise<Ocr> | undefined;

const openOcr = async (): Promise<Ocr> => {
  const folder = await languageFolder();
  try {
    const worker = await createWorker([...OCR_LANGUAGES], undefined, {
      langPath: folder,
      cacheMethod: 'none',
      // External constraint: with no handler, tesseract.js throws a failed job a second time,
      // outside the promise that the job already rejects.
      errorHandler: () => undefined,
    });
    return { worker, folder };
  } catch (fault) {
    await rm(folder, { recursive: true, force: true });
    throw fault;
  }
};

// Ends one worker thread. The module forgets it only when it is still the one in use, so a
// worker that a later call opened stays open.
const closeOcr = async (held: Promise<Ocr> | undefined): Promise<void> => {
  if (ocr === held) ocr = undefined;
  const opened = await held?.catch(() => undefined);
  if (opened === undefined) return;
  await opened.worker.terminate().catch(() => undefined);
  await rm(opened.folder, { recursive: true, force: true });
};

/** Ends the OCR worker thread. A later call starts a new one. */
export const endOcr = async (): Promise<void> => closeOcr(ocr);

/** An image that OCR does not read: its size is not read, it is above the cap, or the job failed
 * or ran past its deadline. */
export class RefusedImageError extends Error {
  constructor(reason: string, options?: ErrorOptions) {
    super(reason, options);
    this.name = 'RefusedImageError';
  }
}

// Assumption of the first build: a large unit tree that Tochnyi exports is some 10,000 by 5,000
// pixels. The cap admits it, and it stops an image whose header asks for gigabytes of memory to
// decode.
const MAX_PIXELS = 50_000_000;

// Assumption of the first build: OCR of a large unit tree takes some tens of seconds. A job that
// runs longer is stuck, and it holds the worker thread from every other image.
const OCR_DEADLINE_MS = 120_000;

interface Size {
  readonly width: number;
  readonly height: number;
}

// External constraint: a PNG file opens with its signature and then the IHDR chunk, which holds
// the width and the height as two big-endian 32-bit integers.
const PNG_START = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
];

const pngSize = (view: DataView): Size | undefined => {
  if (view.byteLength < 24) return undefined;
  if (PNG_START.some((byte, at) => view.getUint8(at) !== byte)) return undefined;
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

// External constraint: a JPEG file is a list of segments, each one a marker and a big-endian
// length. A start-of-frame marker (C0 to CF, less C4, C8 and CC) holds the height and the width.
const NOT_A_FRAME: ReadonlySet<number> = new Set([0xc4, 0xc8, 0xcc]);

const jpegSize = (view: DataView): Size | undefined => {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return undefined;
  let at = 2;
  while (at + 9 <= view.byteLength) {
    if (view.getUint8(at) !== 0xff) return undefined;
    const marker = view.getUint8(at + 1);
    if (marker >= 0xc0 && marker <= 0xcf && !NOT_A_FRAME.has(marker))
      return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
    at += 2 + view.getUint16(at + 2);
  }
  return undefined;
};

const sizeOf = (bytes: Uint8Array): Size | undefined => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return pngSize(view) ?? jpegSize(view);
};

const reasonOf = (fault: unknown): string =>
  (fault instanceof Error ? fault.message : String(fault)).split('\n')[0] ?? '';

const imagePage = async (bytes: Uint8Array): Promise<string> => {
  const size = sizeOf(bytes);
  if (size === undefined)
    throw new RefusedImageError('no width and height are read from the image');
  const pixels = size.width * size.height;
  if (pixels > MAX_PIXELS)
    throw new RefusedImageError(
      `the image holds ${pixels} pixels, and OCR reads no image above ${MAX_PIXELS} pixels`,
    );

  ocr ??= openOcr().catch((fault: unknown) => {
    ocr = undefined;
    throw fault;
  });
  const held = ocr;
  const { worker } = await held;
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RefusedImageError(`OCR did not end within ${OCR_DEADLINE_MS / 1000} seconds`));
    }, OCR_DEADLINE_MS);
  });
  try {
    const { data } = await Promise.race([worker.recognize(Buffer.from(bytes)), deadline]);
    return withoutNul(data.text.trim());
  } catch (fault) {
    // A failed or stuck job can leave the worker thread in a bad state, so the next image gets a
    // new one.
    await closeOcr(held);
    if (fault instanceof RefusedImageError) throw fault;
    throw new RefusedImageError(`OCR could not read the image: ${reasonOf(fault)}`, {
      cause: fault,
    });
  } finally {
    clearTimeout(timer);
  }
};

const IMAGE = new Set(['image/png', 'image/jpeg']);

export const extractText = async (bytes: Uint8Array, mime: string): Promise<Extracted> => {
  const type = (mime.split(';')[0] ?? '').trim().toLowerCase();
  if (type === 'application/pdf') return { pages: await pdfPages(bytes) };
  if (type === 'text/html') return { pages: [htmlPage(bytes, false)] };
  // XHTML is HTML written as XML. The Publications Office of the EU gives the official text of an
  // act in it.
  if (type === 'application/xhtml+xml') return { pages: [htmlPage(bytes, true)] };
  if (PLAIN.has(type)) return { pages: [withoutNul(new TextDecoder('utf-8').decode(bytes))] };
  if (IMAGE.has(type)) return { pages: [await imagePage(bytes)] };
  throw new UnsupportedTypeError(mime);
};
