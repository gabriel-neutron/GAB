import { UPLOAD_FILE_BYTES } from '@gab/proposal/upload-limit';
import type { RawObject } from '@gab/store';
import { checkedDay, RefusedFile, storeBytes } from '@gab/worker/ingest';
import { DatabaseError } from 'pg';
import { z } from 'zod';

import type { Sessions } from './pool.ts';
import { refusalFrom } from './refusal.ts';

/** The one thing the upload reaches outside the database: the raw store, which takes an object
 * and returns the key the row records. */
export interface ObjectDoor {
  put(object: RawObject): Promise<string>;
}

/** One upload, read and checked. Nothing of it was sent anywhere yet. */
export interface Upload {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly title: string;
  readonly retrievedAt: string;
  readonly uri: string | null;
  readonly providerId: string | null;
  /** Euros as the decimal text the column takes, so no float reaches the record. */
  readonly costEur: string | null;
}

const REFUSED = 422;
const TOO_LARGE = 413;
const UNAVAILABLE = 503;
const DONE = 200;

export type ParsedUpload =
  | { readonly ok: true; readonly upload: Upload }
  | {
      readonly ok: false;
      readonly status: typeof REFUSED | typeof TOO_LARGE;
      readonly refusal: string;
    };

const WEB_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:']);

// The largest value that numeric(12,2) holds.
const LARGEST_COST = 9_999_999_999.99;

const blank = (value: string): boolean => value.trim() === '';

const inCents = (value: number): boolean => Math.round(value * 100) / 100 === value;

const request = z.strictObject({
  fileName: z.string().refine((value) => !blank(value), 'the file has no name'),
  title: z.string().refine((value) => !blank(value), 'the title is blank'),
  content: z.base64('the content is not base64'),
  retrievedAt: z.string().optional(),
  uri: z
    .string()
    .refine(
      (value) => WEB_SCHEMES.has(URL.parse(value)?.protocol ?? ''),
      'the address is not an http or an https address',
    )
    .optional(),
  providerId: z
    .string()
    .refine((value) => !blank(value), 'the provider is blank')
    .optional(),
  costEur: z
    .number('the cost is a number of euros')
    .min(0, 'the cost is not negative')
    .max(LARGEST_COST, 'the cost is larger than the record holds')
    .refine(inCents, 'the cost has at most two decimals')
    .optional(),
});

const refused = (refusal: string): ParsedUpload => ({ ok: false, status: REFUSED, refusal });

const readJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

// A top-level field names the box the caller corrects, so it leads the sentence.
const faulted = (issue: { readonly path: PropertyKey[]; readonly message: string }): string => {
  const [first] = issue.path;
  return typeof first === 'string' ? `${first}: ${issue.message}` : issue.message;
};

const TOO_LARGE_FILE = `the file is larger than ${String(UPLOAD_FILE_BYTES / 1024 / 1024)} MiB`;

/** Read one request body. It reads no store and no database, so a refusal here writes nothing. */
export const parseUpload = (raw: string): ParsedUpload => {
  const held = request.safeParse(readJson(raw));
  if (!held.success) {
    const [issue] = held.error.issues;
    return refused(issue === undefined ? 'the body is not an upload' : faulted(issue));
  }
  const body = held.data;

  let retrievedAt: string;
  try {
    retrievedAt = checkedDay(body.retrievedAt, 'retrievedAt');
  } catch (error) {
    return refused(error instanceof Error ? error.message : 'retrievedAt is not a day');
  }

  // The body cap counts characters, and padding moves the count. The bytes are counted again.
  const bytes = new Uint8Array(Buffer.from(body.content, 'base64'));
  if (bytes.length === 0) return refused('content: the file holds no byte');
  if (bytes.length > UPLOAD_FILE_BYTES)
    return { ok: false, status: TOO_LARGE, refusal: TOO_LARGE_FILE };

  return {
    ok: true,
    upload: {
      bytes,
      fileName: body.fileName.trim(),
      title: body.title.trim(),
      retrievedAt,
      uri: body.uri ?? null,
      providerId: body.providerId?.trim() ?? null,
      costEur: body.costEur === undefined ? null : body.costEur.toFixed(2),
    },
  };
};

export type UploadReply =
  | {
      readonly state: 'stored' | 'known';
      readonly documentId: string;
      readonly emptyPages: readonly number[];
    }
  | { readonly refusal: string };

/** What one request became: the status and the body the door answers. */
export interface UploadAct {
  readonly status: typeof DONE | typeof REFUSED | typeof TOO_LARGE | typeof UNAVAILABLE;
  readonly reply: UploadReply;
}

const NO_PROVIDER = 'providerId: the record holds no provider of that name';

// The same bytes are never stored twice, so a caller that met this answer sends the file again.
const NOT_ANSWERED =
  'the raw store or the database did not answer, and the document may not be stored. Send it ' +
  'again: the same file is never stored twice';

// External constraint: class 22 is a value the record cannot hold, and class 23 a rule the row
// breaks. Each one came from the statement, so nothing was written. Every other fault is a
// service that did not answer.
const refusedByRecord = (cause: unknown): boolean =>
  cause instanceof DatabaseError && /^2[23]/u.test(cause.code ?? '');

const failed = (cause: unknown): UploadAct => {
  if (cause instanceof RefusedFile) return { status: REFUSED, reply: { refusal: cause.message } };
  if (cause instanceof DatabaseError && cause.code === '23503')
    return { status: REFUSED, reply: { refusal: NO_PROVIDER } };
  if (refusedByRecord(cause)) return { status: REFUSED, reply: { refusal: refusalFrom(cause) } };
  console.error('the upload did not reach the end', { cause });
  return { status: UNAVAILABLE, reply: { refusal: NOT_ANSWERED } };
};

/** Store one uploaded file through the door that the ingest command uses. A known file answers
 * the id of the row that already holds its bytes. */
export const uploadDocument = async (
  pool: Sessions,
  store: ObjectDoor,
  raw: string,
): Promise<UploadAct> => {
  const parsed = parseUpload(raw);
  if (!parsed.ok) return { status: parsed.status, reply: { refusal: parsed.refusal } };
  const { upload } = parsed;

  let session;
  try {
    session = await pool.connect();
  } catch (cause) {
    return failed(cause);
  }
  try {
    const result = await storeBytes(store, session, { ...upload, kind: 'file' });
    return {
      status: DONE,
      reply: {
        state: result.status,
        documentId: result.id,
        emptyPages: result.status === 'stored' ? result.emptyPages : [],
      },
    };
  } catch (cause) {
    return failed(cause);
  } finally {
    session.release();
  }
};
