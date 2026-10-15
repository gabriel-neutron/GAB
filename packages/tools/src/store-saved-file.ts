// A page that refuses a robot often opens in a real browser: the browser of the operator has a home
// address and real cookies. This tool stores the bytes that such a browser held, under the address
// of the page that they came from. The browser gives the bytes in base64 (a large file in more
// than one part), or the operator saves a file into the inbox folder by hand. The bytes are what
// the browser held (the document of the page after its scripts ran), not the answer that the
// server sent, so the title says so. The text is checked as the fetch checks it, and the hash decides the identity.

import { createHash } from 'node:crypto';
import { open, realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';

import { UPLOAD_FILE_BYTES } from '@gab/proposal/upload-limit';
import {
  extractText,
  mimeOfFileName,
  RefusedImageError,
  RefusedTextError,
  UnsupportedTypeError,
} from '@gab/text';
import { ZIP_MIME } from '@gab/text/geojson';
import { z } from 'zod';

import { addressTitle, htmlTitle } from './fetch-document.ts';
import { storeAnswer } from './store-answer.ts';
import { defineTool, ToolRefusal } from './tool.ts';
import { isHtml, unreadablePage } from './unreadable-page.ts';

// A browser saves a page as a PDF or as HTML, and an image as a PNG or a JPEG file. A data file of
// an API that refuses the server is saved as text: the reader refuses bytes that are no strict
// UTF-8 text.
const TEXT_TYPES = [
  'application/json',
  'text/tab-separated-values',
  'text/plain',
  'application/xml',
  'text/csv',
  'text/markdown',
] as const;
const CONTENT_TYPES = [
  'application/pdf',
  'text/html',
  'image/png',
  'image/jpeg',
  ...TEXT_TYPES,
] as const;
// A GeoJSON archive is read layer by layer. Other archives give no text.
const SAVED_TYPES: ReadonlySet<string> = new Set([
  ...CONTENT_TYPES,
  'application/xhtml+xml',
  ZIP_MIME,
]);
const SAVED_EXTENSIONS =
  '.pdf, .html, .xhtml, .png, .jpg, .jpeg, .json, .tsv, .txt, .xml, .csv, .md or a GeoJSON .zip';

const MAX_TITLE = 500;
// The base64 text of the largest file that a store accepts.
const MAX_CONTENT = Math.ceil(UPLOAD_FILE_BYTES / 3) * 4;
const MAX_PARTS = 1000;
const SAVED_MARK = ' (saved by the browser)';

// External constraint: Windows reads a colon as a data stream of another file, refuses these
// characters, drops a dot or a space at the end of a name, and opens a device for these names.
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
const FORBIDDEN = /[\\/:<>"|?*\p{Cc}]/u;

/** The reason that a name is no plain file name of the inbox, or null when it is one. */
export const nameFault = (name: string): string | null => {
  if (name === '' || name.length > 255) return 'give a file name of 1 to 255 characters';
  if (FORBIDDEN.test(name)) return 'give the name of one file of the inbox, with no folder';
  if (name.startsWith('.')) return 'a hidden file is not read';
  if (/[. ]$/u.test(name)) return 'a name that ends with a dot or a space is not read';
  if (WINDOWS_DEVICE.test(name)) return 'the name of a device is not read';
  return null;
};

const fileName = z
  .string()
  .trim()
  .superRefine((name, context) => {
    const fault = nameFault(name);
    if (fault !== null) context.addIssue({ code: 'custom', message: fault });
  });

// The address of the page in the browser. It names the source of the bytes, and a stored address
// never holds a user name or a password.
const sourceAddress = z.url({ protocol: /^https?$/u }).refine((url) => {
  const parsed = new URL(url);
  return parsed.username === '' && parsed.password === '';
}, 'the address holds no user name and no password');

// A file is read through one open handle, so a file that changes after the checks is not read.
// A second hard link can name a file outside the inbox, so a file with more than one link is
// refused.
const readInboxFile = async (inbox: string, name: string): Promise<Uint8Array> => {
  let root: string;
  try {
    root = await realpath(inbox);
  } catch {
    throw new ToolRefusal(`the inbox folder ${inbox} does not exist`);
  }
  let real: string;
  try {
    real = await realpath(join(root, name));
  } catch {
    throw new ToolRefusal(`the inbox holds no file named ${name}`);
  }
  if (!real.startsWith(root + sep)) throw new ToolRefusal(`${name} is not inside the inbox`);
  let handle;
  try {
    handle = await open(real, 'r');
  } catch {
    throw new ToolRefusal(`${name} cannot be read`);
  }
  try {
    const held = await handle.stat();
    if (!held.isFile()) throw new ToolRefusal(`${name} is not a plain file of the inbox`);
    if (held.nlink !== 1) throw new ToolRefusal(`${name} has more than one link`);
    if (held.size > UPLOAD_FILE_BYTES)
      throw new ToolRefusal(`${name} is larger than ${String(UPLOAD_FILE_BYTES)} bytes`);
    const bytes = new Uint8Array(held.size);
    const { bytesRead } = await handle.read(bytes, 0, held.size, 0);
    if (bytesRead !== held.size) throw new ToolRefusal(`${name} changed while it was read`);
    return bytes;
  } finally {
    await handle.close();
  }
};

// The parts of a file that came in more than one call, by the address of the page. One server
// serves one session, so the parts of two pages do not mix.
// shortcut: the parts of an upload that never ends stay in memory until the server stops (each
// is capped at the upload limit); add an expiry if a session leaves many of them.
const heldParts = new Map<
  string,
  { parts: number; type: string; chunks: Buffer[]; size: number }
>();

interface Content {
  readonly url: string;
  readonly content: string;
  readonly type: string;
  readonly part?: number | undefined;
  readonly parts?: number | undefined;
}

// The whole file when this call gives its last part, or the count of the parts held so far.
const bytesOfContent = (
  input: Content,
): { bytes: Buffer } | { received: number; parts: number } => {
  const bytes = Buffer.from(input.content, 'base64');
  const { url, type, part = 1, parts = 1 } = input;
  if (parts === 1) {
    if (bytes.length > UPLOAD_FILE_BYTES)
      throw new ToolRefusal(`the content is larger than ${String(UPLOAD_FILE_BYTES)} bytes`);
    return { bytes };
  }
  if (part === 1) heldParts.set(url, { parts, type, chunks: [], size: 0 });
  const held = heldParts.get(url);
  if (held?.parts !== parts || held.type !== type || held.chunks.length !== part - 1) {
    heldParts.delete(url);
    throw new ToolRefusal(
      `part ${String(part)} of ${String(parts)} is not the next part of ${url}: send the parts ` +
        'again from part 1',
    );
  }
  held.chunks.push(bytes);
  held.size += bytes.length;
  if (held.size > UPLOAD_FILE_BYTES) {
    heldParts.delete(url);
    throw new ToolRefusal(`the content is larger than ${String(UPLOAD_FILE_BYTES)} bytes`);
  }
  if (part < parts) return { received: part, parts };
  heldParts.delete(url);
  return { bytes: Buffer.concat(held.chunks) };
};

const titleOf = (
  given: string | undefined,
  mime: string,
  bytes: Uint8Array,
  url: string,
  type: string,
) => {
  const chosen = given ?? (isHtml(mime) ? htmlTitle(bytes, type) : null) ?? addressTitle(url);
  return `${chosen.slice(0, MAX_TITLE - SAVED_MARK.length)}${SAVED_MARK}`;
};

export const storeSavedFile = defineTool({
  name: 'store_saved_file',
  description:
    'Stores a PDF, an HTML page, a PNG or JPEG image, or a data file (JSON, TSV, CSV, XML, ' +
    'plain text or Markdown) that the browser of the session holds, as the document of the ' +
    'page that it came from. A data file must be strict UTF-8 text; any other binary file, and ' +
    'a ZIP archive that holds no GeoJSON, is refused. Use it only when fetch_document cannot ' +
    'read a page (a bot filter, an empty page, a site that refuses the server). Give the bytes ' +
    'that the browser holds as `content` in base64, with their `type` and the `sha256` of the ' +
    'whole file; give a large file in ' +
    'parts, in order, with `part` and `parts` (each part but the last has a length that is a ' +
    'multiple of 4). Or give `file`, the name of a file that the operator saved into the inbox ' +
    'folder. The bytes are what the browser held after the scripts of the page ran, not the ' +
    'answer of the server, and the title of the document says "saved by the browser". The text ' +
    'is checked as a fetch checks it. The text of an image is what OCR read in it. The same ' +
    'file twice is one document. The tool returns the document id to cite, or, for a part that ' +
    'is not the last, the status waiting.',
  input: z
    .strictObject({
      file: fileName
        .optional()
        .describe('the name of a file in the inbox, for example eu-timeline.html'),
      content: z
        .base64()
        .max(MAX_CONTENT)
        .optional()
        .describe('the bytes that the browser holds, or one part of them, in base64'),
      type: z.enum(CONTENT_TYPES).optional().describe('the type of the bytes in content'),
      sha256: z
        .string()
        .regex(/^[0-9a-f]{64}$/u)
        .optional()
        .describe('the SHA-256 of the whole file in hex, as the browser computed it'),
      part: z.number().int().min(1).max(MAX_PARTS).optional().describe('the number of this part'),
      parts: z.number().int().min(1).max(MAX_PARTS).optional().describe('the count of the parts'),
      url: sourceAddress.describe('the address of the page in the browser'),
      title: z.string().trim().min(1).max(MAX_TITLE).optional().describe('the title of the page'),
    })
    .superRefine((given, context) => {
      const fault = (message: string) => context.addIssue({ code: 'custom', message });
      if ((given.file === undefined) === (given.content === undefined))
        fault('give either file or content');
      if (given.content !== undefined && given.type === undefined)
        fault('give the type of the content');
      if (given.content !== undefined && given.sha256 === undefined)
        fault('give the sha256 of the content');
      if (
        given.file !== undefined &&
        (given.type ?? given.part ?? given.parts ?? given.sha256) !== undefined
      )
        fault('type, sha256, part and parts go with content, not with file');
      if ((given.part === undefined) !== (given.parts === undefined))
        fault('give part and parts together');
      if (given.part !== undefined && given.parts !== undefined && given.part > given.parts)
        fault('part is not larger than parts');
    }),
  output: z.union([
    z.strictObject({
      document: z.string(),
      status: z.enum(['stored', 'known']),
      title: z.string(),
      pages: z.number().int(),
    }),
    z.strictObject({
      status: z.literal('waiting'),
      received: z.number().int(),
      parts: z.number().int(),
    }),
  ]),
  async run(session, input, reach) {
    if (reach?.store === undefined)
      throw new ToolRefusal('this surface gives no object store, so it stores no file');
    let mime: string;
    let bytes: Uint8Array;
    let label: string;
    // The type that decodes the text. A browser gives HTML in UTF-8, but the page can still name
    // the charset of its origin in a meta element, and the charset of the type comes first.
    let decodeAs: string;
    if (input.content !== undefined && input.type !== undefined) {
      const got = bytesOfContent({ ...input, content: input.content, type: input.type });
      if (!('bytes' in got)) return { status: 'waiting' as const, ...got };
      // The agent copies the base64 text by hand, so the hash of the browser proves the copy.
      if (createHash('sha256').update(got.bytes).digest('hex') !== input.sha256)
        throw new ToolRefusal(
          'the bytes do not have the sha256 that the browser gave: send the parts again from part 1',
        );
      mime = input.type;
      decodeAs = mime === 'text/html' ? 'text/html; charset=utf-8' : mime;
      ({ bytes } = got);
      label = 'the content';
    } else {
      const file = input.file ?? '';
      if (reach.inbox === undefined)
        throw new ToolRefusal('this surface gives no inbox folder, so it stores no saved file');
      const named = mimeOfFileName(file);
      if (named === undefined || !SAVED_TYPES.has(named))
        throw new ToolRefusal(
          `${file} is not a saved page or a text file, and no reader takes its type: give a ` +
            `${SAVED_EXTENSIONS} file`,
        );
      mime = named;
      decodeAs = named;
      bytes = await readInboxFile(reach.inbox, file);
      label = file;
    }

    let pages: readonly string[];
    try {
      ({ pages } = await extractText(bytes, decodeAs));
    } catch (fault) {
      if (
        fault instanceof UnsupportedTypeError ||
        fault instanceof RefusedImageError ||
        fault instanceof RefusedTextError
      )
        throw new ToolRefusal(`${label}: ${fault.message}`);
      throw new ToolRefusal(`no text is read from ${label}`);
    }
    if (mime === ZIP_MIME && pages.length === 0)
      throw new ToolRefusal(
        `${label} is a ZIP archive with no GeoJSON layer, and an archive is not stored as one ` +
          'opaque file. To unpack a ZIP archive into one document for each file is a separate ' +
          'feature: unpack it by hand and store each file',
      );
    if (pages.join('').trim() === '') throw new ToolRefusal(`${label} holds no text`);
    const unreadable = unreadablePage(mime, pages);
    if (unreadable !== null) throw new ToolRefusal(unreadable);

    const stored = await storeAnswer(session, reach.store, {
      kind: 'url',
      bytes,
      mime,
      uri: input.url,
      title: titleOf(input.title, mime, bytes, input.url, decodeAs),
      pages,
      day: reach.now().toISOString().slice(0, 10),
    });
    return { document: stored.id, status: stored.status, title: stored.title, pages: pages.length };
  },
});
