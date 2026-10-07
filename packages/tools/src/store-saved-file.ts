// A page that refuses a robot often opens in a real browser: the browser of the operator has a home
// address and real cookies. This tool stores a file that such a browser saved into the inbox
// folder, under the address of the page that it came from. The bytes are what the browser held
// (the document of the page after its scripts ran), not the answer that the server sent, so the
// title says so. The text is checked as the fetch checks it, and the hash decides the identity.

import { open, realpath } from 'node:fs/promises';
import { join, sep } from 'node:path';

import { UPLOAD_FILE_BYTES } from '@gab/proposal/upload-limit';
import { extractText, mimeOfFileName, UnsupportedTypeError } from '@gab/text';
import { z } from 'zod';

import { htmlTitle } from './fetch-document.ts';
import { storeAnswer } from './store-answer.ts';
import { defineTool, ToolRefusal } from './tool.ts';
import { isHtml, unreadablePage } from './unreadable-page.ts';

// A browser saves a page as a PDF or as HTML, and an image as a PNG or a JPEG file. A text file in
// the inbox is no copy of a page.
const SAVED_TYPES = new Set([
  'application/pdf',
  'text/html',
  'application/xhtml+xml',
  'image/png',
  'image/jpeg',
]);

const MAX_TITLE = 500;
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

const titleOf = (given: string | undefined, mime: string, bytes: Uint8Array, url: string) => {
  const { hostname, pathname } = new URL(url);
  const chosen =
    given ?? (isHtml(mime) ? htmlTitle(bytes) : null) ?? `${hostname}${decodeURI(pathname)}`;
  return `${chosen.slice(0, MAX_TITLE - SAVED_MARK.length)}${SAVED_MARK}`;
};

export const storeSavedFile = defineTool({
  name: 'store_saved_file',
  description:
    'Stores a PDF, an HTML page or a PNG or JPEG image that the browser of the session saved ' +
    'into the inbox folder, as the document of the page that it came from. Use it only when ' +
    'fetch_document cannot read a page (a bot filter, an empty page, a site that refuses the ' +
    'server). The bytes are what the browser held after the scripts of the page ran, not the ' +
    'answer of the server, and the title of the document says "saved by the browser". The text ' +
    'is checked as a fetch checks it. The text of an image is what OCR read in it. The same ' +
    'file twice is one document. The tool returns the document id to cite.',
  input: z.strictObject({
    file: fileName.describe('the name of the file in the inbox, for example eu-timeline.html'),
    url: sourceAddress.describe('the address of the page in the browser'),
    title: z.string().trim().min(1).max(MAX_TITLE).optional().describe('the title of the page'),
  }),
  output: z.strictObject({
    document: z.string(),
    status: z.enum(['stored', 'known']),
    title: z.string(),
    pages: z.number().int(),
  }),
  async run(session, input, reach) {
    if (reach?.store === undefined)
      throw new ToolRefusal('this surface gives no object store, so it stores no file');
    if (reach.inbox === undefined)
      throw new ToolRefusal('this surface gives no inbox folder, so it stores no saved file');
    const mime = mimeOfFileName(input.file);
    if (mime === undefined || !SAVED_TYPES.has(mime))
      throw new ToolRefusal(
        `${input.file} is not a saved page: give a .pdf, .html, .xhtml, .png, .jpg or .jpeg file`,
      );
    const bytes = await readInboxFile(reach.inbox, input.file);

    let pages: readonly string[];
    try {
      ({ pages } = await extractText(bytes, mime));
    } catch (fault) {
      if (fault instanceof UnsupportedTypeError) throw new ToolRefusal(fault.message);
      throw new ToolRefusal(`no text is read from ${input.file}`);
    }
    if (pages.join('').trim() === '') throw new ToolRefusal(`${input.file} holds no text`);
    const unreadable = unreadablePage(mime, pages);
    if (unreadable !== null) throw new ToolRefusal(unreadable);

    const stored = await storeAnswer(session, reach.store, {
      kind: 'url',
      bytes,
      mime,
      uri: input.url,
      title: titleOf(input.title, mime, bytes, input.url),
      pages,
      day: reach.now().toISOString().slice(0, 10),
    });
    return { document: stored.id, status: stored.status, title: stored.title, pages: pages.length };
  },
});
