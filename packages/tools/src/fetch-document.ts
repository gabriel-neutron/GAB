import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { extractText, UnsupportedTypeError } from '@gab/text';
import { ExifTool } from 'exiftool-vendored';
import { z } from 'zod';

import { checkedRange, documentText } from './document-text.ts';
import { rowsOf } from './fields.ts';
import { FetchRefusal, guardedGet, type GetOptions, type Got } from './fetch-guard.ts';
import { MAX_SUBRESOURCES, renderPage } from './render-page.ts';
import { defineTool, type Reach, type Session, ToolRefusal } from './tool.ts';

// Assumptions of the first build, each one a constant. A report of a regulator runs to a few
// megabytes, and a slow server answers inside twenty seconds or it is a server to read later.
export const MAX_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;

// A page that a script draws gives its shell and almost no text. Under this count of characters the
// page is rendered with no flag, and the bytes of the origin stay stored as they came.
const RENDER_BELOW = 200;

// The whole render, from the launch of the browser to the read of the page. A page that a script
// draws is quiet inside a few seconds, or it is a page that this tool reads only in part.
const RENDER_BUDGET_MS = 30_000;

// The words that the common CAPTCHA services put in a page. A page that holds one is stored as it
// is, and the answer says so; nothing on it is solved or avoided.
const CAPTCHA = /captcha|cf-turnstile|cf-challenge|challenge-platform/iu;

// External constraint: the worker writes the text of a stored file under this same word, and a
// second word would make two sets of pages for one reading. The worker holds the other copy, in
// its ingest module.
const EXTRACTOR = 'text-1';

const UNIQUE_VIOLATION = '23505';

const KNOWN = `SELECT d.id::text AS id, d.title, d.mime, d.retrieved_at::text AS retrieved_at
                 FROM public.documents d WHERE d.sha256 = $1`;

// One statement is one transaction, and it holds inside the transaction of a caller too. The row
// is written first and its text second, so a document never exists with no text.
const STORE = `WITH stored AS (
    SELECT public.put_fetched_document('url', $1, $2, $3, $4, $5, $6::date)::text AS id)
  SELECT s.id, public.put_document_text(s.id, $7::jsonb, $8) AS pages FROM stored s`;

const knownRow = z.object({
  id: z.string(),
  title: z.string(),
  mime: z.string().nullable(),
  retrieved_at: z.string().nullable(),
});

const storedRow = z.object({ id: z.string(), pages: z.number().int() });

// The process of exiftool lives as long as the module uses it. A caller that ends ends it too, or
// the process holds the event loop open.
let exiftool: ExifTool | undefined;

/** Ends the exiftool process. A later call starts a new one. */
export const endMetadata = async (): Promise<void> => {
  const held = exiftool;
  exiftool = undefined;
  await held?.end();
};

const EXTENSION: Readonly<Record<string, string>> = {
  'application/pdf': '.pdf',
  'text/html': '.html',
};

const textOf = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim();
  if (typeof value === 'object' && value !== null && 'toISOString' in value) {
    const iso: unknown = (value as { toISOString: () => unknown }).toISOString();
    return typeof iso === 'string' ? iso : null;
  }
  return null;
};

interface Metadata {
  readonly author: string | null;
  readonly created: string | null;
  readonly title: string | null;
}

const NO_METADATA: Metadata = { author: null, created: null, title: null };

// A file that exiftool cannot read gives no metadata. It is no refusal, and the store goes on.
const metadataOf = async (bytes: Uint8Array, mime: string): Promise<Metadata> => {
  let folder: string | undefined;
  try {
    folder = await mkdtemp(join(tmpdir(), 'gab-fetch-'));
    const file = join(folder, `document${EXTENSION[mime] ?? '.bin'}`);
    await writeFile(file, bytes);
    exiftool ??= new ExifTool({ maxProcs: 1, taskTimeoutMillis: 10_000 });
    const tags = await exiftool.read(file);
    return {
      author: textOf(tags.Author) ?? textOf(tags.Creator),
      created: textOf(tags.CreateDate),
      title: textOf(tags.Title),
    };
  } catch {
    return NO_METADATA;
  } finally {
    if (folder !== undefined) await rm(folder, { recursive: true, force: true });
  }
};

const mimeOf = (contentType: string | null, bytes: Uint8Array): string => {
  const given = (contentType?.split(';')[0] ?? '').trim().toLowerCase();
  if (given !== '') return given;
  if (Buffer.from(bytes.subarray(0, 5)).toString('latin1') === '%PDF-') return 'application/pdf';
  throw new ToolRefusal('the server named no type for the answer, and no type is read from it');
};

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' ',
};

const htmlTitle = (bytes: Uint8Array): string | null => {
  const head = new TextDecoder('utf-8').decode(bytes.subarray(0, 65_536));
  const found = /<title[^>]*>([\s\S]*?)<\/title>/iu.exec(head)?.[1];
  if (found === undefined) return null;
  const plain = found
    .replace(/&(#39|[a-z]+);/giu, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/\s+/gu, ' ')
    .trim();
  return plain === '' ? null : plain;
};

const MAX_TITLE = 500;

const titleOf = (mime: string, bytes: Uint8Array, metadata: Metadata, url: string): string => {
  const { hostname, pathname } = new URL(url);
  const chosen =
    (mime === 'text/html' ? htmlTitle(bytes) : null) ??
    metadata.title ??
    `${hostname}${decodeURI(pathname)}`;
  return chosen.slice(0, MAX_TITLE);
};

const isUniqueViolation = (fault: unknown): boolean =>
  typeof fault === 'object' && fault !== null && 'code' in fault && fault.code === UNIQUE_VIOLATION;

const knownOf = async (session: Session, sha256: string) => {
  const [row] = await rowsOf(session, knownRow, KNOWN, [sha256]);
  return row;
};

interface Fetched {
  readonly bytes: Uint8Array;
  readonly mime: string;
  readonly uri: string;
  readonly title: string;
  readonly pages: readonly string[];
  readonly day: string;
}

// Bytes already stored are known by their hash, and nothing is written for them.
const storeFetched = async (session: Session, reach: Reach, fetched: Fetched) => {
  const sha256 = createHash('sha256').update(fetched.bytes).digest('hex');
  let status: 'known' | 'stored' = 'known';
  let known = await knownOf(session, sha256);
  if (known === undefined) {
    // The key holds the hash alone, as the worker writes it, so the two paths name one object.
    const key = await reach.store.put({
      key: `raw/${sha256}`,
      bytes: fetched.bytes,
      mime: fetched.mime,
    });
    try {
      await rowsOf(session, storedRow, STORE, [
        fetched.title,
        key,
        fetched.uri,
        sha256,
        fetched.mime,
        fetched.day,
        JSON.stringify(fetched.pages),
        EXTRACTOR,
      ]);
      status = 'stored';
    } catch (fault) {
      // A second caller stored the same bytes at the same instant.
      if (!isUniqueViolation(fault)) throw fault;
    }
    known = await knownOf(session, sha256);
    if (known === undefined) throw new Error('the door stored a document and no row holds it');
  }
  return { ...known, status };
};

const sameText = (a: readonly string[], b: readonly string[]): boolean =>
  a.join('\n').replace(/\s+/gu, ' ').trim() === b.join('\n').replace(/\s+/gu, ' ').trim();

const reasonOf = (fault: unknown): string =>
  (fault instanceof Error ? fault.message : String(fault)).split('\n')[0]?.slice(0, 200) ?? '';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

// A launch fault, a crash or a timeout of the browser gives a notice and no refusal, because the
// plain document is already stored and its text still comes back.
const renderedOf = async (
  got: Got,
  mime: string,
  options: GetOptions,
  notices: string[],
): Promise<{ html: string; bytes: Uint8Array; pages: readonly string[] } | null> => {
  try {
    const page = await renderPage(got.url, got.bytes, got.contentType ?? mime, {
      ...options,
      budgetMs: RENDER_BUDGET_MS,
    });
    if (page.refused > 0)
      notices.push(
        `the page made ${plural(page.refused, 'request')} to the machine or to a private ` +
          'network, and each one was stopped',
      );
    if (page.capped)
      notices.push(
        `the page asked for more than ${MAX_SUBRESOURCES} files, and the rest were stopped`,
      );
    if (page.timedOut)
      notices.push(
        `the page was not quiet within ${RENDER_BUDGET_MS / 1000} seconds, and the rendered ` +
          'text is what it held then',
      );
    const bytes = new TextEncoder().encode(page.html);
    return { html: page.html, bytes, pages: (await extractText(bytes, 'text/html')).pages };
  } catch (fault) {
    notices.push(`the page could not be rendered: ${reasonOf(fault)}`);
    return null;
  }
};

const outputShape = z.strictObject({
  document: z.string(),
  status: z.enum(['known', 'stored']),
  title: z.string(),
  mime: z.string(),
  url: z.string(),
  retrievedAt: z.string(),
  metadata: z.strictObject({ author: z.string().nullable(), created: z.string().nullable() }),
  pages: z.array(z.strictObject({ page: z.number().int().min(1), text: z.string() })),
  lastPage: z.number().int().nullable(),
  truncated: z.boolean(),
  notice: z.string().nullable(),
  rendered: z
    .strictObject({
      document: z.string(),
      status: z.enum(['known', 'stored']),
      title: z.string(),
    })
    .nullable(),
});

export const fetchDocument = defineTool({
  name: 'fetch_document',
  description:
    'Reads one web page or file at one http or https address, stores its bytes as a document, ' +
    'and returns the document id and the text of its pages. Cite the id in a proposal. A page ' +
    'whose bytes are already stored comes back as "known", and nothing is written. The pages ' +
    'follow the caps of document_text. An HTML page is also loaded in a headless browser when ' +
    '"render" is true, or when its text is shorter than "renderBelow" characters (0 turns this ' +
    'off). The browser runs the scripts of the page and clicks, fills and scrolls nothing. Its ' +
    'HTML is a second document with the same address, named in "rendered", and the pages then ' +
    'come from it; "document" stays the bytes that the server gave. "notice" says what the ' +
    'render did, what it stopped, and when a page looks like a CAPTCHA.',
  input: z.strictObject({
    url: z.string().trim().min(1).max(2048),
    fromPage: z.number().int().min(1).default(1),
    toPage: z.number().int().min(1).optional(),
    render: z.boolean().default(false),
    renderBelow: z.number().int().min(0).default(RENDER_BELOW),
  }),
  output: outputShape,
  async run(session, input, reach) {
    if (reach === undefined)
      throw new ToolRefusal('this surface gives no object store, so it fetches no page');
    const toPage = checkedRange(input.fromPage, input.toPage);

    const day = reach.now().toISOString().slice(0, 10);
    const getOptions: GetOptions = {
      maxBytes: MAX_BYTES,
      timeoutMs: TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
      ...(reach.lookup === undefined ? {} : { lookup: reach.lookup }),
      ...(reach.refuses === undefined ? {} : { refuses: reach.refuses }),
    };
    let got;
    try {
      got = await guardedGet(input.url, getOptions);
    } catch (fault) {
      if (fault instanceof FetchRefusal) throw new ToolRefusal(fault.message);
      throw fault;
    }

    const mime = mimeOf(got.contentType, got.bytes);
    // The text is read before any write, so an answer with no text that can be read leaves no
    // object behind.
    let pages: readonly string[];
    try {
      ({ pages } = await extractText(got.bytes, mime));
    } catch (fault) {
      if (fault instanceof UnsupportedTypeError) throw new ToolRefusal(fault.message);
      throw new ToolRefusal(`no text is read from the answer of type ${mime}`);
    }

    const metadata = await metadataOf(got.bytes, mime);
    const plain = await storeFetched(session, reach, {
      bytes: got.bytes,
      mime,
      uri: got.url,
      title: titleOf(mime, got.bytes, metadata, got.url),
      pages,
      day,
    });

    const notices: string[] = [];
    let captcha = mime === 'text/html' && CAPTCHA.test(new TextDecoder('utf-8').decode(got.bytes));
    let rendered: { id: string; status: 'known' | 'stored'; title: string } | null = null;
    const allText = pages.join('').trim().length;
    const html = mime === 'text/html';
    if (input.render && !html)
      notices.push(`only an HTML page is rendered, and this answer is ${mime}`);
    if (html && !input.render && allText < input.renderBelow)
      notices.push(
        `the page gave ${allText} characters of text, so it was rendered with JavaScript`,
      );

    if (html && (input.render || allText < input.renderBelow)) {
      // The plain document is stored first, so a fault of the browser loses no part of it.
      const page = await renderedOf(got, mime, getOptions, notices);
      if (page !== null) {
        captcha ||= CAPTCHA.test(page.html);
        // The browser writes the HTML again, so its bytes differ from the origin even when no
        // script ran. Only a change of the text makes a second document worth storing.
        if (sameText(page.pages, pages))
          notices.push('the render changed no text, so no second document is stored');
        else {
          const stored = await storeFetched(session, reach, {
            bytes: page.bytes,
            mime: 'text/html',
            uri: got.url,
            title: `${plain.title} (rendered)`.slice(0, MAX_TITLE),
            pages: page.pages,
            day,
          });
          rendered = { id: stored.id, status: stored.status, title: stored.title };
        }
      }
    }
    if (captcha)
      notices.push('the stored page looks like a CAPTCHA page, and nothing on it was solved');

    const text = await documentText.run(session, {
      document: rendered?.id ?? plain.id,
      fromPage: input.fromPage,
      toPage,
    });
    return {
      document: plain.id,
      status: plain.status,
      title: plain.title,
      mime: plain.mime ?? mime,
      url: got.url,
      retrievedAt: plain.retrieved_at ?? day,
      metadata: { author: metadata.author, created: metadata.created },
      pages: text.pages,
      lastPage: text.lastPage,
      truncated: text.truncated,
      notice: notices.length === 0 ? null : notices.join('; '),
      rendered:
        rendered === null
          ? null
          : { document: rendered.id, status: rendered.status, title: rendered.title },
    };
  },
});
