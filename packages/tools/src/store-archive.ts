// A zip archive that holds no GeoJSON layer is unpacked into one child document for each file.
// The archive is a document too: its bytes are kept, and its text lists its files with the
// hash of each one. Each child follows the rules of any document: its text is read and checked
// before any write, the hash decides its identity, and a fetched file is cited as itself. The
// door fill_document_archive links each child to the archive and to its path in it. A hostile
// archive is refused, and nothing is stored.

import {
  extractText,
  mimeOfFileName,
  RefusedImageError,
  RefusedTextError,
  UnsupportedTypeError,
} from '@gab/text';
import { ArchiveRefusal, archiveFiles } from '@gab/text/archive';
import { ZIP_MIME } from '@gab/text/geojson';
import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { hashOf, storeAnswer } from './store-answer.ts';
import { ToolRefusal, type Reach, type Session } from './tool.ts';
import { unreadablePage } from './unreadable-page.ts';

const MAX_TITLE = 500;

// External constraint: SQLSTATE class 22, 23 and P0 is a rule of the record, and its message is
// the sentence of the rule. Null for every other fault.
export const toldFault = (fault: unknown): string | null => {
  if (fault instanceof ToolRefusal) return fault.message;
  if (!(fault instanceof Error) || !('code' in fault)) return null;
  return typeof fault.code === 'string' && /^(?:22|23|P0)/u.test(fault.code) ? fault.message : null;
};

const LINK = 'SELECT public.fill_document_archive($1, $2, $3) AS outcome';

const linkedRow = z.object({ outcome: z.enum(['filled', 'same', 'other', 'not_fetched']) });

/** The archive as a tool read it. */
export interface ArchiveAnswer {
  readonly kind: 'url' | 'api';
  readonly bytes: Uint8Array;
  /** The address of the archive. Each file takes it with its path as the fragment. */
  readonly uri: string;
  readonly title: string;
  readonly day: string;
}

export const storedFileShape = z.strictObject({
  path: z.string(),
  document: z.string(),
  status: z.enum(['stored', 'known']),
  title: z.string(),
  pages: z.number().int(),
  /** What the door did with the link: a file that another archive held first keeps that link
   * (other), and an upload of the operator takes none (not_fetched). */
  linked: z.enum(['filled', 'same', 'other', 'not_fetched']),
});

export const skippedFileShape = z.strictObject({ path: z.string(), reason: z.string() });

interface ReadFile {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly mime: string;
  readonly pages: readonly string[];
}

// The text of one file, or the reason that no reader takes it.
const readFile = async (path: string, bytes: Uint8Array): Promise<ReadFile | string> => {
  const mime = mimeOfFileName(path);
  if (mime === undefined || mime === ZIP_MIME) return 'no reader takes the type of its name';
  let pages: readonly string[];
  try {
    ({ pages } = await extractText(bytes, mime));
  } catch (fault) {
    if (
      fault instanceof UnsupportedTypeError ||
      fault instanceof RefusedImageError ||
      fault instanceof RefusedTextError
    )
      return fault.message;
    return 'no text is read from it';
  }
  if (pages.join('').trim() === '') return 'it holds no text';
  return unreadablePage(mime, pages) ?? { path, bytes, mime, pages };
};

// The text of the archive: each file with its size and its hash, and each file that was not
// stored with the reason.
const listingOf = (
  files: readonly ReadFile[],
  skipped: readonly z.infer<typeof skippedFileShape>[],
): string =>
  [
    `The zip archive holds ${String(files.length + skipped.length)} files.`,
    '',
    ...files.map(
      (file) =>
        `${file.path}\t${String(file.bytes.length)} bytes\tsha256 ${hashOf(file.bytes)}\t${file.mime}`,
    ),
    ...skipped.map((file) => `${file.path}\tnot stored: ${file.reason}`),
  ].join('\n');

/** True when a page of the archive is a GeoJSON layer with a feature. The layer reader takes each
 * JSON file as a layer, and a JSON file that is no GeoJSON gives a header and no row. */
export const holdsLayers = (pages: readonly string[]): boolean =>
  pages.some((page) => page.split(/\r?\n/u).filter((line) => line !== '').length > 1);

/** Stores the archive and one child document for each file that a reader takes. It refuses a
 * hostile archive, and an archive with no file that a reader takes, before any write. */
export const storeArchive = async (
  session: Session,
  store: NonNullable<Reach['store']>,
  archive: ArchiveAnswer,
) => {
  let unpacked;
  try {
    unpacked = await archiveFiles(archive.bytes);
  } catch (fault) {
    if (fault instanceof ArchiveRefusal)
      throw new ToolRefusal(`the zip archive is not unpacked: ${fault.message}. Nothing is stored`);
    throw fault;
  }
  const files: ReadFile[] = [];
  const skipped: z.infer<typeof skippedFileShape>[] = [];
  for (const { path, bytes } of unpacked) {
    const read = await readFile(path, bytes);
    if (typeof read === 'string') skipped.push({ path, reason: read });
    else files.push(read);
  }
  if (files.length === 0)
    throw new ToolRefusal(
      'the zip archive holds no file that a reader takes' +
        (skipped.length === 0
          ? ''
          : ` (${skipped.map((file) => `${file.path}: ${file.reason}`).join('; ')})`) +
        '. Nothing is stored',
    );

  const parent = await storeAnswer(session, store, {
    kind: archive.kind,
    bytes: archive.bytes,
    mime: ZIP_MIME,
    uri: archive.uri,
    title: archive.title,
    pages: [listingOf(files, skipped)],
    day: archive.day,
  });
  const stored: z.infer<typeof storedFileShape>[] = [];
  // Each store is a write of its own. A fault half way leaves some files stored, and a second
  // call finds them known and stores the rest.
  try {
    for (const file of files) {
      const child = await storeAnswer(session, store, {
        kind: archive.kind,
        bytes: file.bytes,
        mime: file.mime,
        uri: `${archive.uri.split('#')[0] ?? archive.uri}#${encodeURI(file.path)}`,
        title: `${file.path} (in ${parent.title})`.slice(0, MAX_TITLE),
        pages: file.pages,
        day: archive.day,
      });
      const [linked] = await rowsOf(session, linkedRow, LINK, [child.id, parent.id, file.path]);
      if (linked === undefined) throw new Error('the door linked a file and returned no outcome');
      stored.push({
        path: file.path,
        document: child.id,
        status: child.status,
        title: child.title,
        pages: file.pages.length,
        linked: linked.outcome,
      });
    }
  } catch (fault) {
    // Only a refusal of a tool or of a rule of the record is a sentence for the client. Any other
    // fault can name a path or a host, so the operator reads it in the log, as in the server.
    const told = toldFault(fault);
    if (told === null) console.error('an archive file was not stored', fault);
    throw new ToolRefusal(
      `${String(stored.length)} of ${String(files.length)} files of archive ${parent.id} are ` +
        `stored, and the next one failed: ${told ?? 'the operator reads the fault in the log'}. ` +
        'Call the tool again to store the rest',
    );
  }
  return { archive: parent, files: stored, skipped };
};
