import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  decodeHtml,
  extractText,
  RefusedImageError,
  RefusedTextError,
  UnsupportedTypeError,
} from '@gab/text';
import { zipContainerType } from '@gab/text/archive';
import { ZIP_MIME } from '@gab/text/geojson';
import { XLSX_MIME } from '@gab/text/xlsx';
import { ExifTool } from 'exiftool-vendored';
import { z } from 'zod';

import { binaryBytes, declaredMime, decodedBody, GENERIC, textType } from './compressed-body.ts';
import { checkedRange, documentText, nextShape } from './document-text.ts';
import {
  FetchRefusal,
  guardedGet,
  type FetchFault,
  type GetOptions,
  type Got,
} from './fetch-guard.ts';
import {
  isBlockPage,
  isRussianHost,
  PROXY_NOTICE,
  proxyKey,
  readThroughProxy,
} from './hosted-proxy.ts';
import { refusedSource } from './refused-source.ts';
import { renderPage } from './render-page.ts';
import { holdsLayers, skippedFileShape, storeArchive, storedFileShape } from './store-archive.ts';
import { knownAnswer, noteTrace, storeAnswer } from './store-answer.ts';
import { defineTool, ToolRefusal } from './tool.ts';
import { CHALLENGE_PAGE, isHtml, SHORT_PAGE, unreadablePage } from './unreadable-page.ts';

// Assumptions of the first build, each one a constant. A report of a regulator runs to a few
// megabytes, and a slow server answers inside twenty seconds or it is a server to read later.
export const MAX_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
// External constraint: the dissemination API of Eurostat. A file read at this address is a file of
// Eurostat, so it takes the provider and the licence of Eurostat.
const EUROSTAT_API = 'https://ec.europa.eu/eurostat/api/dissemination/';

/** The provider of a file that the tool reads at the address of its publisher, or nothing. */
export const fetchedProvider = (url: string): 'eurostat' | undefined =>
  url.startsWith(EUROSTAT_API) ? 'eurostat' : undefined;
const MAX_REDIRECTS = 5;

// A page that a script draws gives its shell and almost no text. Under this count of characters the
// page is rendered with no flag, and the bytes of the origin stay stored as they came.
const RENDER_BELOW = 200;

// The whole render, from the launch of the browser to the read of the page. A page that a script
// draws is quiet inside a few seconds, or it is a page that this tool reads only in part.
const RENDER_BUDGET_MS = 30_000;

// The words that the common CAPTCHA services put in a page. A short page that holds one is stored as
// it is, and the answer says so; nothing on it is solved or avoided. A long page is an article or a
// record: the script of a wiki or a forum names a CAPTCHA for its own forms, and gives no notice.
const CAPTCHA = /captcha|cf-turnstile|cf-challenge|challenge-platform/iu;

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
  'application/xhtml+xml': '.xhtml',
  'image/png': '.png',
  'image/jpeg': '.jpg',
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

// External constraint: the signatures that open a PNG, a JPEG and a zip file.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const OCR_TYPES: ReadonlySet<string> = new Set(['image/png', 'image/jpeg']);

const opensWith = (bytes: Uint8Array, signature: Buffer): boolean =>
  Buffer.from(bytes.subarray(0, signature.length)).equals(signature);

const sniffedMime = (bytes: Uint8Array): string | undefined => {
  if (Buffer.from(bytes.subarray(0, 5)).toString('latin1') === '%PDF-') return 'application/pdf';
  if (opensWith(bytes, PNG_SIGNATURE)) return 'image/png';
  if (opensWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg';
  if (opensWith(bytes, ZIP_SIGNATURE)) return ZIP_MIME;
  return undefined;
};

// A server that names no type, or names only "bytes", says nothing of the file, so its first
// bytes decide. A file with the signature of a PDF or an image is that file, also when the server
// names it as text.
const mimeOf = (contentType: string | null, bytes: Uint8Array): string => {
  const given = declaredMime(contentType);
  const sniffed = sniffedMime(bytes);
  if (sniffed !== undefined && textType(given)) return sniffed;
  if (given !== '' && given !== GENERIC) return given;
  if (sniffed !== undefined) return sniffed;
  if (given !== '') return given;
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

/** The title of an HTML page, from its title element, or null. The type can name the charset. */
export const htmlTitle = (bytes: Uint8Array, type?: string): string | null => {
  const head = decodeHtml(bytes.subarray(0, 65_536), type);
  const found = /<title[^>]*>([\s\S]*?)<\/title>/iu.exec(head)?.[1];
  if (found === undefined) return null;
  const plain = found
    .replace(/&(#39|[a-z]+);/giu, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/\s+/gu, ' ')
    .trim();
  return plain === '' ? null : plain;
};

const MAX_TITLE = 500;

/** The host and the path of an address, as a title. A path with a percent sequence that is not
 * UTF-8 stays as the address writes it. */
export const addressTitle = (url: string): string => {
  const { hostname, pathname } = new URL(url);
  try {
    return `${hostname}${decodeURI(pathname)}`;
  } catch (fault) {
    if (!(fault instanceof URIError)) throw fault;
    return `${hostname}${pathname}`;
  }
};

const titleOf = (
  mime: string,
  type: string,
  bytes: Uint8Array,
  metadata: Metadata,
  url: string,
): string => {
  const chosen =
    (isHtml(mime) ? htmlTitle(bytes, type) : null) ?? metadata.title ?? addressTitle(url);
  return chosen.slice(0, MAX_TITLE);
};

// A fault of the browser can name a path of the machine, and so the user name. The agent gets a
// fixed sentence, and the operator reads the fault in the log.
export const RENDER_FAULT =
  'the page could not be rendered, and the operator reads the fault in the log';

// The step that each refusal of a bot filter names, so the research AI and the operator know what
// to do next. A filter that the Chrome window of readThroughFilter does not pass also gives it.
const BROWSER_STEP =
  "Next step: open the page in a browser on the operator's machine, and give the bytes " +
  'that it holds to store_saved_file (skill research-method)';
const NEEDS_STEP =
  "Next step: open the page in a browser on the operator's machine and store it with " +
  'store_saved_file; if the browser gets no answer either, list the source in ' +
  'research/out/needs.md (skill research-method)';

// External constraint: the statuses that Cloudflare and the other common filters give to a
// request that they take for a robot.
const FILTER_STATUSES: ReadonlySet<number> = new Set([403, 429, 503]);

// Qrator and DataDome refuse a robot with a 401, so the browser also reads a page that gave one.
const BROWSER_STATUSES: ReadonlySet<number> = new Set([401, ...FILTER_STATUSES]);

/** The refusal of a failed fetch, with the step for a bot filter or a server that is silent. */
export const refusalOfFetch = (message: string, fault: FetchFault | undefined): string => {
  if (fault?.kind === 'silent')
    return (
      `${message}. A site that refuses foreign addresses or robots gives no answer, and ` +
      `nothing is stored. ${NEEDS_STEP}.`
    );
  if (fault?.kind === 'status' && FILTER_STATUSES.has(fault.status))
    return (
      `${message}. A bot filter (for example a Cloudflare challenge) gives this answer, and ` +
      `nothing is stored. ${BROWSER_STEP}.`
    );
  return message;
};

type RenderState = 'none' | 'rendered' | 'failed';

const AFTER: Readonly<Record<RenderState, string>> = {
  none: '',
  rendered: ', also after the render with JavaScript',
  failed: ', and the render with JavaScript failed',
};

/** The refusal of an answer that holds no text, after its render when it had one. */
export const emptyRefusal = (status: number, mime: string, render: RenderState): string => {
  const after = AFTER[render];
  if (!isHtml(mime) && mime !== 'text/plain')
    return `the answer of type ${mime} holds no text${after}, so it holds nothing to cite, and nothing is stored`;
  const filter =
    status === 202
      ? `the server answered 202 with a page that holds no text${after}. A bot filter (for ` +
        'example AWS WAF) gives this answer'
      : `the answer holds no text${after}, so it holds nothing to cite. A bot filter can give ` +
        'an empty page';
  return `${filter}, and nothing is stored. ${BROWSER_STEP}.`;
};

/** The refusal of a challenge page or a missing page, with the step for a challenge. */
const unreadableRefusal = (sentence: string): string =>
  sentence === CHALLENGE_PAGE ? `${sentence}, and nothing is stored. ${BROWSER_STEP}.` : sentence;

const blank = (pages: readonly string[]): boolean => pages.join('').trim() === '';

const ERROR_KEYS: ReadonlySet<string> = new Set(['error', 'message', 'status']);

/**
 * The message of a JSON error that a server sends with a success status, or null. The shape comes
 * from a real ENTSOG answer: an object with only the keys error, message and status. An object
 * with other keys is data, also when it holds the key error.
 */
export const jsonErrorOf = (bytes: Uint8Array): string | null => {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const fields = value as Record<string, unknown>;
  const keys = Object.keys(fields);
  if (!keys.includes('error') || keys.some((key) => !ERROR_KEYS.has(key))) return null;
  const said = fields['message'] ?? fields['error'];
  return (typeof said === 'string' ? said : JSON.stringify(said)).slice(0, 300);
};

const isJson = (mime: string): boolean => mime === 'application/json' || mime.endsWith('+json');

// The text of a shell is its title at most. A page with other text holds text of its own.
const shellOnly = (bytes: Uint8Array, type: string, pages: readonly string[]): boolean => {
  const text = pages.join(' ').replace(/\s+/gu, ' ').trim();
  const title = htmlTitle(bytes, type);
  return (title === null ? text : text.replace(title, '').trim()) === '';
};

const blankBytes = (bytes: Uint8Array): boolean =>
  new TextDecoder('utf-8').decode(bytes).trim() === '';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

// A launch fault, a crash or a timeout of the browser gives a notice and no refusal, because the
// plain document can still be stored, and its text comes back.
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
    if (page.timedOut)
      notices.push(
        `the page was not quiet within ${RENDER_BUDGET_MS / 1000} seconds, and the rendered ` +
          'text is what it held then',
      );
    const bytes = new TextEncoder().encode(page.html);
    // The browser gives the page as a string, so its bytes are UTF-8, also when a meta element of the
    // page still names the charset of the origin.
    const pages = (await extractText(bytes, 'text/html; charset=utf-8')).pages;
    return { html: page.html, bytes, pages };
  } catch (fault) {
    console.error(fault);
    notices.push(RENDER_FAULT);
    return null;
  }
};

// The text is read before any write, so an answer with no text that can be read leaves no object
// behind.
const checkedPages = async (
  bytes: Uint8Array,
  mime: string,
  type: string,
): Promise<readonly string[]> => {
  // An answer with no bytes but blanks holds no text, whatever its type says. The caller refuses it.
  if (blankBytes(bytes)) return [''];
  // An error is no record of the source, also when the server gives it as a success.
  const error = isJson(mime) ? jsonErrorOf(bytes) : null;
  if (error !== null)
    throw new ToolRefusal(
      `the server sent a JSON error with a success status: "${error}". It holds no data, and ` +
        'nothing is stored',
    );
  let pages: readonly string[];
  try {
    ({ pages } = await extractText(bytes, type));
  } catch (fault) {
    if (
      fault instanceof UnsupportedTypeError ||
      fault instanceof RefusedImageError ||
      fault instanceof RefusedTextError
    )
      throw new ToolRefusal(fault.message);
    throw new ToolRefusal(`no text is read from the answer of type ${mime}`);
  }

  // An image with no text gives nothing to cite, and an excerpt could never be checked on it.
  if (mime.startsWith('image/') && pages.join('').trim() === '')
    throw new ToolRefusal('OCR read no text in the image, so it holds nothing to cite');

  // A challenge or a missing page is no record of the source, and it leaves no object behind.
  const unreadable = unreadablePage(mime, pages);
  if (unreadable !== null) throw new ToolRefusal(unreadableRefusal(unreadable));
  return pages;
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
  next: nextShape,
  notice: z.string().nullable(),
  files: z.array(storedFileShape).nullable(),
  skipped: z.array(skippedFileShape).nullable(),
  /** The fingerprint of the certificate of a host on the list of the Russian root, else null. */
  certificate: z.string().nullable(),
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
    'and returns the document id and the text of its pages. Cite the id of the document that ' +
    'gave the pages in a proposal. A page whose bytes are already stored comes back as ' +
    '"known", and nothing is written. The pages follow the caps of document_text. When "next" ' +
    'is present, read on with document_text: give the id of the document that gave the pages, ' +
    'and give "next" as fromPage and fromCharacter. An HTML page ' +
    'is also loaded in a headless browser when its text is shorter ' +
    `than ${String(RENDER_BELOW)} characters, or when "render" is true. The stored render is ` +
    'marked as a render. The browser runs the scripts of the ' +
    'page and clicks, fills and scrolls nothing. Its HTML is a second document with the same ' +
    'address, named in "rendered"; "document" stays the bytes that the server gave. When ' +
    '"rendered" is present, the pages come from it: cite rendered.document and queue the ' +
    'extraction of that id. "notice" says what the render did, what it stopped, and when a ' +
    'page looks like a CAPTCHA. A short page that is a bot challenge or says it is missing is ' +
    'refused, and nothing is stored. When only its render shows it, the page is refused if it ' +
    'holds no text but its title; else its own text stays and the render is not stored. A page ' +
    'with no text, also after its render, is refused, and nothing is stored. When the server ' +
    'refuses the plain request with 401, 403, 429 or 503, the page is read in a Chrome window ' +
    'that waits up to 30 seconds for the bot filter; the stored bytes are the HTML that the ' +
    'browser shows, and "notice" says so. Nothing on the page is clicked or solved. Each refusal ' +
    'of a bot filter that also stops the browser (a 403, an empty ' +
    '202, a challenge page, no answer) names the next step: open the page in a browser and ' +
    'store it with store_saved_file, or list it in research/out/needs.md. A compressed answer ' +
    '(gzip, deflate or brotli, also with no Content-Encoding header, as a raw capture of the ' +
    'Wayback Machine) is decoded, and the decoded bytes are stored. An answer of a text type ' +
    'whose bytes are not text is refused. A data file (JSON, CSV, TSV, XML, plain text, any ' +
    'type that ends with +json or +xml, and every SDMX type) must be strict UTF-8 with no ' +
    'control character but tab, line feed and carriage return, or it is refused. Its bytes are ' +
    'stored as they came. The text of a JSON file is an indented view of it; when the view ' +
    'would change a number or an escape, the text is the raw file. A JSON error that the ' +
    'server sends with a success status (an object with only the keys error, message and ' +
    'status) is refused. A text above 16 MiB is cut into pages at the end of a line, and a ' +
    'table repeats its header line on each page. A PNG or a JPEG image is stored as ' +
    'its bytes, and its pages are the text that OCR read in it (English, Ukrainian and ' +
    'Russian). A Nominatim, Overpass or geocoder answer and a search result page are refused, ' +
    'and nothing is stored: a geocoder is a check of an address only, and a search lists ' +
    'pages. OCR can misread a sign: cite an excerpt as the stored text gives it, and ' +
    'compare it with the image. An image in which OCR reads no text is refused. A ZIP archive ' +
    'that holds no GeoJSON is unpacked: "document" is the archive, whose text lists its files, ' +
    'and "files" names one more document for each file that a reader takes, each linked to the ' +
    'archive; cite the document of the file. "skipped" names each other file and the reason. A ' +
    'hostile archive (too large, too deep, a path that leaves it, a zip bomb) is refused. ' +
    'With "proxy" true, a .ru or .рф host whose plain read fails (or gives the block page of ' +
    'the host) is read once through a paid hosted proxy with a Russian exit, when the ' +
    'operator set its key; 10 credits for each page that it reads, and "notice" says so. ' +
    'Set "proxy" only after the other ways failed, for one source that a fact needs. A few ' +
    'Russian hosts have a certificate of the Russian root authority. The tool accepts that ' +
    'root for those hosts alone, and "certificate" gives the fingerprint that the server ' +
    'showed. A state authority can intercept such a read, so cross-check its content.',
  input: z.strictObject({
    url: z.string().trim().min(1).max(2048),
    fromPage: z.number().int().min(1).default(1),
    toPage: z.number().int().min(1).optional(),
    proxy: z.boolean().default(false),
    render: z.boolean().default(false),
  }),
  output: outputShape,
  async run(session, input, reach) {
    if (reach?.store === undefined)
      throw new ToolRefusal('this surface gives no object store, so it fetches no page');
    const toPage = checkedRange(input.fromPage, input.toPage);
    const refused = refusedSource(input.url);
    if (refused !== null) throw new ToolRefusal(refused);

    const day = reach.now().toISOString().slice(0, 10);
    const getOptions: GetOptions = {
      maxBytes: MAX_BYTES,
      timeoutMs: reach.fetchTimeoutMs ?? TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
      ...(reach.lookup === undefined ? {} : { lookup: reach.lookup }),
      ...(reach.refuses === undefined ? {} : { refuses: reach.refuses }),
      ...(reach.extraRoot === undefined ? {} : { extraRoot: reach.extraRoot }),
    };
    const notices: string[] = [];
    let got: Got;
    let throughFilter = false as boolean; // set in a closure, so the type stays wide
    // A Russian host that refuses the direct read is read once through the hosted proxy.
    const key = input.proxy && isRussianHost(input.url) ? proxyKey(reach.hostedProxyKey) : null;
    const viaProxy = async (key: string): Promise<Got> => {
      try {
        const read = await readThroughProxy(input.url, key, getOptions, reach.hostedProxyEndpoint);
        notices.push(PROXY_NOTICE);
        return read;
      } catch (fault) {
        if (!(fault instanceof FetchRefusal)) throw fault;
        throw new ToolRefusal(`${fault.message}, and nothing is stored`);
      }
    };
    const throughChrome = async (fault: FetchRefusal): Promise<Got> => {
      const passed =
        fault.fault?.kind === 'status' &&
        BROWSER_STATUSES.has(fault.fault.status) &&
        reach.readThroughFilter !== undefined
          ? await reach.readThroughFilter(input.url, getOptions)
          : null;
      if (passed === null || typeof passed === 'string') {
        const tried = passed === null ? '' : ` The Chrome window was also tried: ${passed}.`;
        throw new ToolRefusal(`${refusalOfFetch(fault.message, fault.fault)}${tried}`);
      }
      notices.push(
        `${fault.message.replace(/, and only a success is kept$/u, '')} to the plain request, so ` +
          'the page was read in a Chrome window; the stored bytes are the HTML that the browser shows',
      );
      throughFilter = true;
      return {
        url: passed.url,
        status: 200,
        contentType: 'text/html; charset=utf-8',
        contentEncoding: null,
        lastModified: null,
        certFingerprint: null,
        bytes: new TextEncoder().encode(passed.html),
      };
    };
    try {
      got = await guardedGet(input.url, getOptions);
      if (key !== null && isBlockPage(got.bytes)) got = await viaProxy(key);
    } catch (fault) {
      if (!(fault instanceof FetchRefusal)) throw fault;
      if (key === null) got = await throughChrome(fault);
      else {
        // The Chrome window is free, so a bot filter meets it first; the proxy costs credits.
        try {
          got = await throughChrome(fault);
        } catch (refusal) {
          if (!(refusal instanceof ToolRefusal)) throw refusal;
          got = await viaProxy(key);
        }
      }
    }
    // A state authority can intercept a read that the Russian root signs.
    if (got.certFingerprint !== null)
      notices.push(
        'the server showed a certificate that the Russian root authority signed, which this tool accepts ' +
          `for this host alone (SHA-256 ${got.certFingerprint}); a state authority can intercept ` +
          'this read, so cross-check the content',
      );
    // A redirect can lead to an address that is no source.
    const redirected = refusedSource(got.url);
    if (redirected !== null) throw new ToolRefusal(redirected);
    // The stored bytes are the page that the server encoded, not its compressed form, so their
    // text is read and an excerpt is checked on them.
    got = {
      ...got,
      bytes: decodedBody(got.bytes, got.contentEncoding, got.contentType, MAX_BYTES),
    };

    let mime = mimeOf(got.contentType, got.bytes);
    // A workbook is a zip container too, so the parts of the container decide its type. Another
    // office document has no reader, and it is not unpacked into its XML parts.
    if (mime === ZIP_MIME) {
      const container = await zipContainerType(got.bytes);
      if (container === 'workbook') mime = XLSX_MIME;
      if (container === 'office')
        throw new ToolRefusal(
          'the answer is an office document (a text document or a slide set) that no reader ' +
            'takes, and nothing is stored',
        );
    }
    // Bytes that are not text give a text of noise, and an excerpt of it could never be checked.
    if (textType(mime) && binaryBytes(got.bytes, got.contentType))
      throw new ToolRefusal(
        `the answer of type ${mime} holds no readable text: its bytes are compressed in a format ` +
          `that this tool does not decode, or they are binary. Nothing is stored. ${BROWSER_STEP}.`,
      );
    // The type with its parameters, so the charset that the server names decodes an HTML page.
    const type = isHtml(mime) && got.contentType !== null ? got.contentType : mime;
    // OCR of an image takes seconds, and bytes that are already stored have their text already.
    const known = OCR_TYPES.has(mime) ? await knownAnswer(session, got.bytes) : undefined;
    const pages = known === undefined ? await checkedPages(got.bytes, mime, type) : [];

    // An archive with no GeoJSON layer gives no text of its own: each of its files is a document.
    if (known === undefined && mime === ZIP_MIME && !holdsLayers(pages)) {
      const metadata = await metadataOf(got.bytes, mime);
      const unpacked = await storeArchive(session, reach.store, {
        kind: 'url',
        bytes: got.bytes,
        uri: got.url,
        title: titleOf(mime, type, got.bytes, metadata, got.url),
        day,
      });
      await noteTrace(session, unpacked.archive.id, got.certFingerprint, false);
      const text = await documentText.run(session, {
        document: unpacked.archive.id,
        fromPage: input.fromPage,
        fromCharacter: 0,
        toPage,
      });
      return {
        document: unpacked.archive.id,
        status: unpacked.archive.status,
        title: unpacked.archive.title,
        mime: unpacked.archive.mime ?? mime,
        url: got.url,
        retrievedAt: unpacked.archive.retrieved_at ?? day,
        metadata: { author: metadata.author, created: metadata.created },
        pages: text.pages,
        lastPage: text.lastPage,
        truncated: text.truncated,
        next: text.next,
        notice: notices.length === 0 ? null : notices.join('; '),
        files: unpacked.files,
        skipped: unpacked.skipped,
        certificate: got.certFingerprint,
        rendered: null,
      };
    }

    let page: Awaited<ReturnType<typeof renderedOf>> = null;
    const allText = pages.join('').trim().length;
    // Bytes that are all blank hold no script to run, so the render can add nothing to them.
    const renders =
      known === undefined &&
      !throughFilter &&
      !notices.includes(PROXY_NOTICE) &&
      mime === 'text/html' &&
      (input.render || allText < RENDER_BELOW) &&
      !blankBytes(got.bytes);
    if (renders) {
      notices.push(
        input.render
          ? 'the render was asked for, so the page was rendered with JavaScript'
          : `the page gave ${allText} characters of text, so it was rendered with JavaScript`,
      );
      // The render comes before any write, so a page with no text, also after the render, leaves
      // no object behind. A fault of the browser gives a notice, and the plain page stays.
      page = await renderedOf(got, mime, getOptions, notices);
    }
    // A render that gives a challenge or a missing page is no record of the source. When the plain
    // page holds no text but its title, it is the shell of that page, and nothing is stored. When
    // the plain page holds its own text, that text stays, and only the render is not stored.
    const unreadableRender = page === null ? null : unreadablePage('text/html', page.pages);
    if (unreadableRender !== null && shellOnly(got.bytes, type, pages))
      throw new ToolRefusal(unreadableRefusal(unreadableRender));
    if (unreadableRender !== null)
      notices.push(
        'the render was not stored: it shows a challenge of a bot filter or a missing page, ' +
          'and the text comes from the plain page',
      );
    const usable = page !== null && unreadableRender === null && !blank(page.pages) ? page : null;

    // An answer with no text is no record of the source: no plain page and no render is stored.
    if (known === undefined && allText === 0 && usable === null) {
      const render: RenderState = page !== null ? 'rendered' : renders ? 'failed' : 'none';
      throw new ToolRefusal(emptyRefusal(got.status, mime, render));
    }
    if (page !== null && unreadableRender === null && usable === null)
      notices.push('the render was not stored: it holds no text');

    // The bytes of the origin are stored also when their text is empty and the render has text.
    // They are the record of what the server gave, and the render is a copy that the browser made
    // from them. The page as a whole is not empty: its text is in the render, which is cited.
    const metadata = await metadataOf(got.bytes, mime);
    const provider = fetchedProvider(got.url);
    const plain =
      known ??
      (await storeAnswer(session, reach.store, {
        kind: 'url',
        bytes: got.bytes,
        mime,
        uri: got.url,
        title: titleOf(mime, type, got.bytes, metadata, got.url),
        pages,
        day,
        ...(provider === undefined ? {} : { provider }),
      }));

    await noteTrace(session, plain.id, got.certFingerprint, false);
    let rendered: { id: string; status: 'known' | 'stored'; title: string } | null = null;
    if (usable !== null) {
      const stored = await storeAnswer(session, reach.store, {
        kind: 'url',
        bytes: usable.bytes,
        mime: 'text/html',
        uri: got.url,
        title: `${plain.title} (rendered)`.slice(0, MAX_TITLE),
        pages: usable.pages,
        day,
      });
      rendered = { id: stored.id, status: stored.status, title: stored.title };
      await noteTrace(session, stored.id, got.certFingerprint, true);
    }
    // The notice is about the page that is cited: the render when it is stored, else the plain page.
    const captcha =
      usable === null
        ? isHtml(mime) && allText <= SHORT_PAGE && CAPTCHA.test(decodeHtml(got.bytes, type))
        : usable.pages.join('').trim().length <= SHORT_PAGE && CAPTCHA.test(usable.html);
    if (captcha)
      notices.push('the stored page looks like a CAPTCHA page, and nothing on it was solved');

    const text = await documentText.run(session, {
      document: rendered?.id ?? plain.id,
      fromPage: input.fromPage,
      fromCharacter: 0,
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
      next: text.next,
      notice: notices.length === 0 ? null : notices.join('; '),
      files: null,
      skipped: null,
      certificate: got.certFingerprint,
      rendered:
        rendered === null
          ? null
          : { document: rendered.id, status: rendered.status, title: rendered.title },
    };
  },
});
