import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';

import type { RawObject } from '@gab/store';
import { extractText, mimeOfFileName } from '@gab/text';

import { DEFAULT_INCLUDE, type WalkOptions } from './ingest-walk.ts';

// External constraint: the text door keys a set of pages by document, extractor and page, so a
// better extractor writes a new set beside the old one under a new word. This word names the
// extractor of today.
const EXTRACTOR = 'text-1';

const KINDS = ['file', 'report'] as const;
type Kind = (typeof KINDS)[number];

export interface IngestOptions {
  readonly retrievedAt: string;
  readonly kind: Kind;
  readonly title: string | undefined;
  /** The address where the file comes from. A run of the kind `file` names it (PU1). */
  readonly uri: string | undefined;
  /** The provider of a bought filing, as the record names it. */
  readonly providerId: string | undefined;
  /** The cost of a bought file in euros, as the decimal text the column takes. */
  readonly costEur: string | undefined;
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

const WEB_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:']);

// PU1, the ruling of 9 October 2026 after #403: a file of the operator comes from the Internet,
// and the address where it comes from makes it a public document. A run of the kind `file` with
// no address stores nothing. A load report does not come from the Internet, so it needs none.
const checkedUri = (stated: string | undefined, kind: Kind): string | undefined => {
  if (stated === undefined) {
    if (kind === 'file')
      throw new Error('--uri is required: give the address where the file comes from.');
    return undefined;
  }
  const uri = stated.trim();
  if (!WEB_SCHEMES.has(URL.parse(uri)?.protocol ?? ''))
    throw new Error(`--uri "${stated}" is not an http or an https address.`);
  return uri;
};

// The cost is euros with at most two decimals, and numeric(12,2) holds ten digits before the
// point. The text goes to the column as it is, so no float reaches the record. A bought file is
// not public (PU1), so the command records the cost as the upload form does.
const COST = /^\d{1,10}(?:\.\d{1,2})?$/u;

const checkedCost = (stated: string | undefined): string | undefined => {
  if (stated === undefined) return undefined;
  const cost = stated.trim();
  if (!COST.test(cost))
    throw new Error(
      `--cost-eur "${stated}" is not a cost in euros: give a number that is not negative, ` +
        'with at most two decimals.',
    );
  return Number(cost).toFixed(2);
};

const checkedProvider = (stated: string | undefined): string | undefined => {
  if (stated === undefined) return undefined;
  if (stated.trim() === '') throw new Error('--provider is blank.');
  return stated.trim();
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
      uri: { type: 'string' },
      'cost-eur': { type: 'string' },
      provider: { type: 'string' },
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
  const uri = checkedUri(values.uri, kind);
  if (uri !== undefined && positionals.length > 1)
    throw new Error('--uri names one file, and this run names more than one.');
  const include = values.include ?? DEFAULT_INCLUDE;
  if (include.some((glob) => glob.trim() === '')) throw new Error('--include is blank.');
  return {
    paths: positionals,
    options: {
      retrievedAt,
      kind,
      title,
      uri,
      providerId: checkedProvider(values.provider),
      costEur: checkedCost(values['cost-eur']),
      dryRun: values['dry-run'] === true,
    },
    walk: { recursive: values.recursive === true, include },
  };
};

/** A title and an address name one document, and a folder gives any number, so the walk is
 * checked too. */
export const checkedTitle = (files: readonly string[], options: IngestOptions): void => {
  if (options.title !== undefined && files.length !== 1)
    throw new Error(`--title names one file, and this run takes ${files.length}.`);
  if (options.uri !== undefined && files.length !== 1)
    throw new Error(`--uri names one file, and this run takes ${files.length}.`);
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
const FILL_URI = 'SELECT public.fill_document_uri($1, $2) AS found';

// External constraint: the id comes from the hash, so the second of two callers with the same
// bytes hits the primary key before the index on the hash. Either name is the same bytes only
// when a row holds the hash after the rollback.
const SAME_BYTES: ReadonlySet<unknown> = new Set(['documents_pkey', 'documents_sha256_key']);
const UNIQUE_VIOLATION = '23505';

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : 'the file was not taken';

/** A file that this door does not take: no type is read from its name, its text cannot be read,
 * or it is an image with no text. Nothing was written when it is raised. Every other fault is a
 * fault of a service. */
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
  SAME_BYTES.has(error.constraint);

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
const mimeOf = (fileName: string): string | undefined => mimeOfFileName(basename(fileName));

const hashOf = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

// The text is read before any write, so a file that holds none that can be read leaves no object
// behind. An image with no text gives nothing to cite, and an excerpt could never be checked on it.
const pagesOf = async (bytes: Uint8Array, mime: string): Promise<readonly string[]> => {
  let pages: readonly string[];
  try {
    ({ pages } = await extractText(bytes, mime));
  } catch (error) {
    throw new RefusedFile(`the text of the file cannot be read: ${reasonOf(error)}`, {
      cause: error,
    });
  }
  if (mime.startsWith('image/') && pages.every((page) => page.trim() === ''))
    throw new RefusedFile('OCR read no text in the image, so it holds nothing to cite');
  return pages;
};

const foundOf = (rows: readonly unknown[]): unknown => {
  const [row] = rows;
  return typeof row === 'object' && row !== null && 'found' in row ? row.found : undefined;
};

// PU1, the ruling of 9 October 2026 after #403: the address makes an upload a public document.
// The same bytes are stored once, so a second upload reaches the row of the first one. That row
// gets the address when it has none. The door never changes an address, and it refuses an
// address that it cannot record, so the operator is not told that a file is public when it is
// not.
const known = async (
  session: IngestSession,
  id: string,
  sha256: string,
  uri: string | null,
): Promise<StoreResult> => {
  if (uri !== null) {
    const found = foundOf((await session.query(FILL_URI, [id, uri])).rows);
    if (found === 'other')
      throw new RefusedFile(
        `the record holds this file already as ${id}, with another address, and it does not ` +
          'change an address',
      );
    if (found === 'before_rule')
      throw new RefusedFile(
        `the record holds this file already as ${id}, with an address from before the address ` +
          'rule. That address can be the page where the file was bought, so the file is not ' +
          'public, and the record does not change it',
      );
  }
  return { status: 'known', id, sha256 };
};

/** Store the bytes once: the hash, the known check, the text, the object, then the row and its
 * text. It raises RefusedFile before any write for a file it does not take. A known file gets
 * the address when its row has none. */
export const storeBytes = async (
  door: Pick<IngestDoor, 'put'>,
  session: IngestSession,
  file: StoredFile,
): Promise<StoreResult> => {
  const mime = mimeOf(file.fileName);
  if (mime === undefined) throw new RefusedFile('no type is read from the name of the file');

  const sha256 = hashOf(file.bytes);
  const held = idOfRow((await session.query(LOOKUP, [sha256])).rows);
  if (held !== undefined) return known(session, held, sha256, file.uri);

  const pages = await pagesOf(file.bytes, mime);
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
    return known(session, holder, sha256, file.uri);
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
      uri: options.uri ?? null,
      providerId: options.providerId ?? null,
      costEur: options.costEur ?? null,
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

  const pages = await pagesOf(bytes, mime);
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
