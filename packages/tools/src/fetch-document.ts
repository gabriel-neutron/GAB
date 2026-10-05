import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { extractText, UnsupportedTypeError } from '@gab/text';
import { ExifTool } from 'exiftool-vendored';
import { z } from 'zod';

import { checkedRange, documentText } from './document-text.ts';
import { rowsOf } from './fields.ts';
import { FetchRefusal, guardedGet } from './fetch-guard.ts';
import { defineTool, type Session, ToolRefusal } from './tool.ts';

// Assumptions of the first build, each one a constant. A report of a regulator runs to a few
// megabytes, and a slow server answers inside twenty seconds or it is a server to read later.
export const MAX_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;

// A page that a script draws gives its shell and almost no text. Under this count the answer says
// so, and the page stays stored, because its bytes are still the bytes the origin gave.
const LITTLE_TEXT = 200;

// External constraint: the worker writes the text of a stored file under this same word, and a
// second word would make two sets of pages for one reading. The worker holds the other copy, in
// its ingest module.
const EXTRACTOR = 'text-1';

// A bot check answers with status 200 and a few words. A caller that took it as a page would read
// "searched, found nothing". A real article with a comment form has the same mark and a long text.
const CHALLENGE_TEXT = 1000;
const CHALLENGE_MARKS =
  /g-recaptcha|h-captcha|cf-turnstile|cf-challenge|cdn-cgi\/challenge-platform|<title[^>]*>\s*(just a moment\.\.\.|attention required!)/iu;

const isChallengePage = (bytes: Uint8Array, textLength: number): boolean =>
  textLength < CHALLENGE_TEXT &&
  CHALLENGE_MARKS.test(new TextDecoder('utf-8').decode(bytes.subarray(0, 262_144)));

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
});

export const fetchDocument = defineTool({
  name: 'fetch_document',
  description:
    'Reads one web page or file at one http or https address, stores its bytes as a document, ' +
    'and returns the document id and the text of its pages. Cite the id in a proposal. A page ' +
    'whose bytes are already stored comes back as "known", and nothing is written. The pages ' +
    'follow the caps of document_text. "notice" says when a page gave little text, because a ' +
    'script draws it and this tool runs none.',
  input: z.strictObject({
    url: z.string().trim().min(1).max(2048),
    fromPage: z.number().int().min(1).default(1),
    toPage: z.number().int().min(1).optional(),
  }),
  output: outputShape,
  async run(session, input, reach) {
    if (reach === undefined)
      throw new ToolRefusal('this surface gives no object store, so it fetches no page');
    const toPage = checkedRange(input.fromPage, input.toPage);

    const day = reach.now().toISOString().slice(0, 10);
    let got;
    try {
      got = await guardedGet(input.url, {
        maxBytes: MAX_BYTES,
        timeoutMs: TIMEOUT_MS,
        maxRedirects: MAX_REDIRECTS,
        ...(reach.lookup === undefined ? {} : { lookup: reach.lookup }),
        ...(reach.refuses === undefined ? {} : { refuses: reach.refuses }),
      });
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

    if (mime === 'text/html' && isChallengePage(got.bytes, pages.join('').trim().length))
      throw new ToolRefusal(
        'the answer is a challenge page (a captcha or a browser check), not the document, and nothing is kept',
      );

    const sha256 = createHash('sha256').update(got.bytes).digest('hex');
    const metadata = await metadataOf(got.bytes, mime);

    let status: 'known' | 'stored' = 'known';
    let known = await knownOf(session, sha256);
    if (known === undefined) {
      // The key holds the hash alone, as the worker writes it, so the two paths name one object.
      const key = await reach.store.put({ key: `raw/${sha256}`, bytes: got.bytes, mime });
      const title = titleOf(mime, got.bytes, metadata, got.url);
      try {
        await rowsOf(session, storedRow, STORE, [
          title,
          key,
          got.url,
          sha256,
          mime,
          day,
          JSON.stringify(pages),
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

    const text = await documentText.run(session, {
      document: known.id,
      fromPage: input.fromPage,
      toPage,
    });
    const allText = pages.join('').trim().length;
    return {
      document: known.id,
      status,
      title: known.title,
      mime: known.mime ?? mime,
      url: got.url,
      retrievedAt: known.retrieved_at ?? day,
      metadata: { author: metadata.author, created: metadata.created },
      pages: text.pages,
      lastPage: text.lastPage,
      truncated: text.truncated,
      notice:
        mime === 'text/html' && allText < LITTLE_TEXT
          ? `the page gave ${allText} characters of text: it may need JavaScript, and this tool runs none`
          : null,
    };
  },
});
