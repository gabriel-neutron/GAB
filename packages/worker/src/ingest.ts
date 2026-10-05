import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { parseArgs } from 'node:util';

import type { RawObject } from '@gab/store';
import { extractText } from '@gab/text';

import { DEFAULT_INCLUDE, type WalkOptions } from './ingest-walk.ts';

// External constraint: the text door keys a set of pages by document, extractor and page, so a
// better extractor writes a new set beside the old one under a new word. This word names the
// extractor of today.
const EXTRACTOR = 'text-1';

// External constraint: the types that extractText reads, by the extension that a file name holds.
// A name with another extension names no type, and the file is refused before any write.
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.pdf': 'application/pdf',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
};

const KINDS = ['file', 'report'] as const;
type Kind = (typeof KINDS)[number];

export interface IngestOptions {
  readonly retrievedAt: string;
  readonly kind: Kind;
  readonly title: string | undefined;
  readonly dryRun: boolean;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Departure: the date of the file system is never read. The day that a file was written is not
// the day that it was retrieved, so the operator states it. The field names the box or the flag
// that the operator corrects.
export const checkedDay = (stated: string | undefined, field = '--retrieved-at'): string => {
  if (stated === undefined || stated === '')
    throw new Error(`${field} is required: the day the files were retrieved, as YYYY-MM-DD.`);
  const real =
    DAY.test(stated) && new Date(`${stated}T00:00:00Z`).toISOString().slice(0, 10) === stated;
  if (!real) throw new Error(`${field} "${stated}" is not a real day, as YYYY-MM-DD.`);
  return stated;
};

/** The paths and the options of a run. It throws before any read when an argument is wrong. */
export const parseIngestArguments = (
  argv: readonly string[],
): {
  readonly paths: readonly string[];
  readonly options: IngestOptions;
  readonly walk: WalkOptions;
} => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: {
      'retrieved-at': { type: 'string' },
      kind: { type: 'string' },
      title: { type: 'string' },
      'dry-run': { type: 'boolean' },
      recursive: { type: 'boolean' },
      include: { type: 'string', multiple: true },
    },
  });
  const retrievedAt = checkedDay(values['retrieved-at']);
  const kind = KINDS.find((word) => word === (values.kind ?? 'file'));
  if (kind === undefined) throw new Error(`--kind is one of: ${KINDS.join(', ')}.`);
  if (positionals.length === 0) throw new Error('Name at least one file or folder.');
  const title = values.title;
  if (title !== undefined) {
    if (positionals.length > 1)
      throw new Error('--title names one file, and this run names more than one.');
    if (title.trim() === '') throw new Error('--title is blank.');
  }
  const include = values.include ?? DEFAULT_INCLUDE;
  if (include.some((glob) => glob.trim() === '')) throw new Error('--include is blank.');
  return {
    paths: positionals,
    options: { retrievedAt, kind, title, dryRun: values['dry-run'] === true },
    walk: { recursive: values.recursive === true, include },
  };
};

/** A title names one document, and a folder gives any number, so the walk is checked too. */
export const checkedTitle = (files: readonly string[], options: IngestOptions): void => {
  if (options.title !== undefined && files.length !== 1)
    throw new Error(`--title names one file, and this run takes ${files.length}.`);
};

/** What the run did with one file. In a dry run `stored` means would be stored. */
export interface IngestOutcome {
  readonly path: string;
  readonly status: 'stored' | 'known' | 'refused';
  readonly id?: string;
  readonly sha256?: string;
  readonly pageCount?: number;
  readonly emptyPages?: readonly number[];
  readonly reason?: string;
}

/** The one line of the run report for a file. */
export const reportLine = (outcome: IngestOutcome): string => {
  if (outcome.status === 'refused') return `refused  ${outcome.path}  ${outcome.reason ?? ''}`;
  const empty = outcome.emptyPages ?? [];
  const tail = empty.length === 0 ? '' : `  no text on pages ${empty.join(', ')}`;
  return `${outcome.status}  ${outcome.path}  ${outcome.id ?? ''}${tail}`;
};

/** The part of a database session that the run uses. A pg client fits it. */
export interface IngestSession {
  query(text: string, values?: readonly unknown[]): Promise<{ readonly rows: readonly unknown[] }>;
  release(): void;
}

/** The two things a run reaches: the database and the object store. */
export interface IngestDoor {
  connect(): Promise<IngestSession>;
  put(object: RawObject): Promise<string>;
}

const LOOKUP = 'SELECT id FROM public.documents WHERE sha256 = $1';
const PUT_DOCUMENT = `SELECT public.put_document($1, $2, $3, $4, $5, NULL, $6, $7, $8::date, $9,
  $10::numeric)`;
const PUT_TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3)';

// External constraint: the unique index on the hash answers for two callers at one instant. The
// one that loses gets this name, and the row of the other one is the document.
const SAME_BYTES = 'documents_sha256_key';
const UNIQUE_VIOLATION = '23505';

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'the file was not taken';

/** A file that this door does not take: no type is read from its name, or its text cannot be
 * read. Nothing was written when it is raised. Every other fault is a fault of a service. */
export class RefusedFile extends Error {}

/** One file to store, with every field its row records. */
export interface StoredFile {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly title: string;
  readonly kind: Kind;
  readonly retrievedAt: string;
  readonly uri: string | null;
  readonly providerId: string | null;
  /** Euros, as the decimal text the column takes, so no float reaches the record. */
  readonly costEur: string | null;
}

/** What the door did with the bytes. A known file names the row that holds the bytes already. */
export type StoreResult =
  | {
      readonly status: 'stored';
      readonly id: string;
      readonly sha256: string;
      readonly pageCount: number;
      readonly emptyPages: readonly number[];
    }
  | { readonly status: 'known'; readonly id: string; readonly sha256: string };

const idOfRow = (rows: readonly unknown[]): string | undefined => {
  const [row] = rows;
  if (typeof row !== 'object' || row === null || !('id' in row)) return undefined;
  return typeof row.id === 'string' ? row.id : undefined;
};

const isSameBytes = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === UNIQUE_VIOLATION &&
  'constraint' in error &&
  error.constraint === SAME_BYTES;

// Departure: the row and its text are written in one transaction, so a document never exists with
// no text and a text never exists with no document. A fault rolls the transaction back, and the
// first fault is the one raised: on a dead socket the ROLLBACK fails too and names no cause.
const writeRow = async (
  session: IngestSession,
  row: StoredFile & {
    readonly id: string;
    readonly key: string;
    readonly sha256: string;
    readonly mime: string;
    readonly pages: readonly string[];
  },
): Promise<void> => {
  await session.query('BEGIN');
  try {
    await session.query(PUT_DOCUMENT, [
      row.id,
      row.kind,
      row.title,
      row.key,
      row.uri,
      row.sha256,
      row.mime,
      row.retrievedAt,
      row.providerId,
      row.costEur,
    ]);
    await session.query(PUT_TEXT, [row.id, JSON.stringify(row.pages), EXTRACTOR]);
    await session.query('COMMIT');
  } catch (error) {
    await session.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
};

/** The type that a file name names, or nothing. */
const mimeOf = (fileName: string): string | undefined =>
  MIME_BY_EXTENSION[extname(fileName).toLowerCase()];

const hashOf = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** Store the bytes once: the hash, the known check, the text, the object, then the row and its
 * text. It raises RefusedFile before any write for a file it does not take. */
export const storeBytes = async (
  door: Pick<IngestDoor, 'put'>,
  session: IngestSession,
  file: StoredFile,
): Promise<StoreResult> => {
  const mime = mimeOf(file.fileName);
  if (mime === undefined) throw new RefusedFile('no type is read from the name of the file');

  const sha256 = hashOf(file.bytes);
  const known = idOfRow((await session.query(LOOKUP, [sha256])).rows);
  if (known !== undefined) return { status: 'known', id: known, sha256 };

  // The text is read before any write, so a file that holds none that can be read leaves no
  // object behind.
  let pages: readonly string[];
  try {
    ({ pages } = await extractText(file.bytes, mime));
  } catch (error) {
    throw new RefusedFile(`the text of the file cannot be read: ${reasonOf(error)}`, {
      cause: error,
    });
  }
  const emptyPages = pages.flatMap((page, at) => (page.trim() === '' ? [at + 1] : []));

  // The key holds the hash alone. A file name can hold any character, and the title keeps it.
  const id = `doc_${sha256.slice(0, 12)}`;
  const key = await door.put({ key: `raw/${sha256}`, bytes: file.bytes, mime });
  try {
    await writeRow(session, { ...file, id, key, sha256, mime, pages });
  } catch (error) {
    if (!isSameBytes(error)) throw error;
    const holder = idOfRow((await session.query(LOOKUP, [sha256])).rows);
    if (holder === undefined) throw error;
    return { status: 'known', id: holder, sha256 };
  }
  return { status: 'stored', id, sha256, pageCount: pages.length, emptyPages };
};

const ingestOne = async (
  door: IngestDoor,
  session: IngestSession,
  path: string,
  options: IngestOptions,
  seen: Set<string>,
): Promise<IngestOutcome> => {
  if (!(await stat(path)).isFile()) return { path, status: 'refused', reason: 'it is not a file' };
  const mime = mimeOf(path);
  if (mime === undefined) return { path, status: 'refused', reason: 'no type is read from it' };

  const bytes = await readFile(path);

  if (!options.dryRun) {
    const result = await storeBytes(door, session, {
      bytes,
      fileName: basename(path),
      title: options.title ?? basename(path),
      kind: options.kind,
      retrievedAt: options.retrievedAt,
      uri: null,
      providerId: null,
      costEur: null,
    });
    seen.add(result.sha256);
    return { path, ...result };
  }

  // A dry run stores nothing, so the table cannot know a second file with the same bytes. The
  // hashes of the run are kept, and the dry run names the second file known as the real run does.
  const sha256 = hashOf(bytes);
  const id = `doc_${sha256.slice(0, 12)}`;
  const isKnown = seen.has(sha256) || (await session.query(LOOKUP, [sha256])).rows.length > 0;
  if (isKnown) return { path, status: 'known', id, sha256 };

  const { pages } = await extractText(bytes, mime);
  const emptyPages = pages.flatMap((page, at) => (page.trim() === '' ? [at + 1] : []));
  seen.add(sha256);
  return { path, status: 'stored', id, sha256, pageCount: pages.length, emptyPages };
};

/** Store each file once. A refused file stops nothing: the run reports it and goes on. */
export const ingestFiles = async (
  door: IngestDoor,
  paths: readonly string[],
  options: IngestOptions,
): Promise<IngestOutcome[]> => {
  const outcomes: IngestOutcome[] = [];
  const seen = new Set<string>();
  for (const path of paths) {
    let session: IngestSession | undefined;
    try {
      session = await door.connect();
      outcomes.push(await ingestOne(door, session, path, options, seen));
    } catch (error) {
      outcomes.push({ path, status: 'refused', reason: reasonOf(error) });
    } finally {
      session?.release();
    }
  }
  return outcomes;
};
