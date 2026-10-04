import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { parseArgs } from 'node:util';

import type { RawObject } from '@gab/store';
import { extractText } from '@gab/text';

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
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Departure: the date of the file system is never read. The day that a file was written is not
// the day that it was retrieved, so the operator states it, and a day that has not come is refused.
const checkedDay = (stated: string | undefined, now: Date): string => {
  if (stated === undefined || stated === '')
    throw new Error('--retrieved-at is required: the day the files were retrieved, as YYYY-MM-DD.');
  const real =
    DAY.test(stated) && new Date(`${stated}T00:00:00Z`).toISOString().slice(0, 10) === stated;
  if (!real) throw new Error(`--retrieved-at "${stated}" is not a real day, as YYYY-MM-DD.`);
  if (stated > now.toISOString().slice(0, 10))
    throw new Error(`--retrieved-at "${stated}" is in the future.`);
  return stated;
};

/** The paths and the options of a run. It throws before any read when an argument is wrong. */
export const parseIngestArguments = (
  argv: readonly string[],
  now: Date,
): { readonly paths: readonly string[]; readonly options: IngestOptions } => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: {
      'retrieved-at': { type: 'string' },
      kind: { type: 'string' },
      title: { type: 'string' },
    },
  });
  const retrievedAt = checkedDay(values['retrieved-at'], now);
  const kind = KINDS.find((word) => word === (values.kind ?? 'file'));
  if (kind === undefined) throw new Error(`--kind is one of: ${KINDS.join(', ')}.`);
  if (positionals.length === 0) throw new Error('Name at least one file.');
  const title = values.title;
  if (title !== undefined) {
    if (positionals.length > 1)
      throw new Error('--title names one file, and this run names more than one.');
    if (title.trim() === '') throw new Error('--title is blank.');
  }
  return { paths: positionals, options: { retrievedAt, kind, title } };
};

/** What the run did with one file. A refused file carries its reason. */
export interface IngestOutcome {
  readonly path: string;
  readonly status: 'stored' | 'known' | 'refused';
  readonly id?: string;
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
  release(error?: Error | boolean): void;
}

/** The two things a run reaches: the database and the object store. */
export interface IngestDoor {
  connect(): Promise<IngestSession>;
  put(object: RawObject): Promise<string>;
}

const LOOKUP = 'SELECT id FROM public.documents WHERE sha256 = $1';
const PUT_DOCUMENT = `SELECT public.put_document($1, $2, $3, $4, NULL, NULL, $5, $6, $7::date)`;
const PUT_TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3)';

const HASH_INDEX = 'documents_sha256_key';

const isRaceOnHash = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === '23505' &&
  'constraint' in error &&
  error.constraint === HASH_INDEX;

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'the file was not taken';

// A client that cannot roll back holds a transaction in an unknown state, so the pool must close it
// and never lend it again.
class DamagedSession extends Error {
  constructor(cause: unknown) {
    super(reasonOf(cause), { cause });
    this.name = 'DamagedSession';
  }
}

// Departure: the row and its text are written in one transaction, so a document never exists with
// no text and a text never exists with no document. A fault rolls the transaction back. The client
// goes back to the pool in every case, and a client that failed to roll back is destroyed.
const writeRow = async (
  session: IngestSession,
  row: {
    readonly id: string;
    readonly options: IngestOptions;
    readonly title: string;
    readonly key: string;
    readonly sha256: string;
    readonly mime: string;
    readonly pages: readonly string[];
  },
): Promise<void> => {
  let open = false;
  try {
    await session.query('BEGIN');
    open = true;
    await session.query(PUT_DOCUMENT, [
      row.id,
      row.options.kind,
      row.title,
      row.key,
      row.sha256,
      row.mime,
      row.options.retrievedAt,
    ]);
    await session.query(PUT_TEXT, [row.id, JSON.stringify(row.pages), EXTRACTOR]);
    await session.query('COMMIT');
    open = false;
  } catch (error) {
    if (open) {
      try {
        await session.query('ROLLBACK');
      } catch {
        throw new DamagedSession(error);
      }
    }
    throw error;
  }
};

const ingestOne = async (
  door: IngestDoor,
  session: IngestSession,
  path: string,
  options: IngestOptions,
): Promise<IngestOutcome> => {
  if (!(await stat(path)).isFile()) return { path, status: 'refused', reason: 'it is not a file' };
  const mime = MIME_BY_EXTENSION[extname(path).toLowerCase()];
  if (mime === undefined) return { path, status: 'refused', reason: 'no type is read from it' };

  const bytes = await readFile(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const id = `doc_${sha256.slice(0, 12)}`;

  const found = await session.query(LOOKUP, [sha256]);
  if (found.rows.length > 0) return { path, status: 'known', id };

  // The text is read before any write, so a file that holds none that can be read leaves no
  // object behind.
  const { pages } = await extractText(bytes, mime);
  const emptyPages = pages.flatMap((page, at) => (page.trim() === '' ? [at + 1] : []));

  // The key holds the hash alone. A file name can hold any character, and the title keeps it.
  const key = await door.put({ key: `raw/${sha256}`, bytes, mime });
  try {
    await writeRow(session, {
      id,
      options,
      title: options.title ?? basename(path),
      key,
      sha256,
      mime,
      pages,
    });
  } catch (error) {
    if (isRaceOnHash(error)) return { path, status: 'known', id };
    throw error;
  }
  return { path, status: 'stored', id, emptyPages };
};

/** Store each file once. A refused file stops nothing: the run reports it and goes on. */
export const ingestFiles = async (
  door: IngestDoor,
  paths: readonly string[],
  options: IngestOptions,
): Promise<IngestOutcome[]> => {
  const outcomes: IngestOutcome[] = [];
  for (const path of paths) {
    let session: IngestSession | undefined;
    let damaged = false;
    try {
      session = await door.connect();
      outcomes.push(await ingestOne(door, session, path, options));
    } catch (error) {
      damaged = error instanceof DamagedSession;
      outcomes.push({ path, status: 'refused', reason: reasonOf(error) });
    } finally {
      session?.release(damaged);
    }
  }
  return outcomes;
};
