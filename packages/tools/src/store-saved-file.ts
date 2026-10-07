// A page that refuses a robot often opens in a real browser: the browser of the operator has a home
// address and real cookies. This tool stores a file that such a browser saved into the inbox
// folder of the research workspace, under the address of the page that it came from. The text is
// checked as the fetch checks it, and the hash decides the identity, as for each stored answer.

import { lstat, readFile, realpath } from 'node:fs/promises';
import { basename, extname, join, sep } from 'node:path';

import { UPLOAD_FILE_BYTES } from '@gab/proposal/upload-limit';
import { extractText, UnsupportedTypeError } from '@gab/text';
import { z } from 'zod';

import { storeAnswer } from './store-answer.ts';
import { defineTool, ToolRefusal } from './tool.ts';
import { unreadablePage } from './unreadable-page.ts';

// External constraint: the types that the text reader takes, by the extension of the file name.
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.pdf': 'application/pdf',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.xhtml': 'application/xhtml+xml',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
};

const MAX_TITLE = 500;

// A file name alone: no folder, no parent, no hidden file. The tool reads nothing outside the inbox.
const fileName = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (name) => basename(name) === name && !name.startsWith('.') && !/[\\/]/u.test(name),
    'give the name of one file of the inbox, with no folder',
  );

// The address of the page in the browser. It names the source of the bytes, and a stored address
// never holds a user name or a password.
const sourceAddress = z.url({ protocol: /^https?$/u }).refine((url) => {
  const parsed = new URL(url);
  return parsed.username === '' && parsed.password === '';
}, 'the address holds no user name and no password');

const inboxFileOf = async (inbox: string, name: string): Promise<string> => {
  const path = join(inbox, name);
  let held;
  try {
    held = await lstat(path);
  } catch {
    throw new ToolRefusal(`the inbox holds no file named ${name}`);
  }
  if (!held.isFile()) throw new ToolRefusal(`${name} is not a plain file of the inbox`);
  if (held.size > UPLOAD_FILE_BYTES)
    throw new ToolRefusal(`${name} is larger than ${String(UPLOAD_FILE_BYTES)} bytes`);
  // The real path must stay inside the real inbox, so a link cannot reach another file.
  const real = await realpath(path);
  const root = await realpath(inbox);
  if (!real.startsWith(root + sep)) throw new ToolRefusal(`${name} is not inside the inbox`);
  return real;
};

export const storeSavedFile = defineTool({
  name: 'store_saved_file',
  description:
    'Stores a file that a browser saved into the inbox folder of the research workspace, as the ' +
    'document of the page that it came from. Use it when fetch_document cannot read a page (a ' +
    'bot filter, an empty page, a site that refuses the server): open the page in the browser, ' +
    'save it (a PDF, or the HTML of the page) into the inbox, then give the file name and the ' +
    'address of the page. The text is checked as a fetch checks it. The same file twice is one ' +
    'document. The tool returns the document id to cite.',
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
    const mime = MIME_BY_EXTENSION[extname(input.file).toLowerCase()];
    if (mime === undefined)
      throw new ToolRefusal(
        `the type of ${input.file} is not read: give a ${Object.keys(MIME_BY_EXTENSION).join(', ')} file`,
      );
    const bytes = new Uint8Array(await readFile(await inboxFileOf(reach.inbox, input.file)));

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
      title: (input.title ?? input.file).slice(0, MAX_TITLE),
      pages,
      day: reach.now().toISOString().slice(0, 10),
    });
    return { document: stored.id, status: stored.status, title: stored.title, pages: pages.length };
  },
});
