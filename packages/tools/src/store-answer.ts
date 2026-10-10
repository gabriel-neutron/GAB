// The one store step of every tool that keeps an answer: the bytes go to the object store under
// their hash, and the row with its text goes through the door of the machine roles. The hash
// decides the identity, so the same answer twice is one document.

import { createHash } from 'node:crypto';

import { z } from 'zod';

import { rowsOf } from './fields.ts';
import type { Reach, Session } from './tool.ts';

// External constraint: the worker writes the text of a stored file under this same word, and a
// second word would make two sets of pages for one reading. The worker holds the other copy, in
// its ingest module.
const EXTRACTOR = 'text-1';

const UNIQUE_VIOLATION = '23505';

const KNOWN = `SELECT d.id::text AS id, d.title, d.mime, d.retrieved_at::text AS retrieved_at
                 FROM public.documents d WHERE d.sha256 = $1`;

// One statement is one transaction, and it holds inside the transaction of a caller too. The row
// is written first and its text second, so a document never exists with no text.
const STORE = `WITH stored AS (
    SELECT public.put_fetched_document($9, $1, $2, $3, $4, $5, $6::date, NULL, $10)::text AS id)
  SELECT s.id, public.put_document_text(s.id, $7::jsonb, $8) AS pages FROM stored s`;

const knownRow = z.object({
  id: z.string(),
  title: z.string(),
  mime: z.string().nullable(),
  retrieved_at: z.string().nullable(),
});

const storedRow = z.object({ id: z.string(), pages: z.number().int() });

/** One answer that a tool read, with its text already taken from it. */
export interface Answer {
  /** `url` for a page that a reader asked for, `api` for the answer of a register. */
  readonly kind: 'url' | 'api';
  readonly bytes: Uint8Array;
  readonly mime: string;
  /** The address of the answer. It never holds a key. */
  readonly uri: string;
  readonly title: string;
  readonly pages: readonly string[];
  readonly day: string;
  /** The publisher of an official file. Its licence gives the tier of the document. A tool names
   * it only for a file that it reads at the address of that publisher. */
  readonly provider?: 'eu_eurlex' | 'ofac_sdn';
}

const isUniqueViolation = (fault: unknown): boolean =>
  typeof fault === 'object' && fault !== null && 'code' in fault && fault.code === UNIQUE_VIOLATION;

const knownOf = async (session: Session, sha256: string) => {
  const [row] = await rowsOf(session, knownRow, KNOWN, [sha256]);
  return row;
};

const hashOf = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** The stored document that holds these bytes, as a known answer, or undefined. It writes
 * nothing. */
export const knownAnswer = async (session: Session, bytes: Uint8Array) => {
  const known = await knownOf(session, hashOf(bytes));
  return known === undefined ? undefined : { ...known, status: 'known' as const };
};

/** Stores the answer once. Bytes that are already stored are known by their hash, and nothing is
 * written for them. */
export const storeAnswer = async (
  session: Session,
  store: NonNullable<Reach['store']>,
  answer: Answer,
) => {
  const sha256 = hashOf(answer.bytes);
  let status: 'known' | 'stored' = 'known';
  let known = await knownOf(session, sha256);
  if (known === undefined) {
    // The key holds the hash alone, as the worker writes it, so the two paths name one object.
    const key = await store.put({ key: `raw/${sha256}`, bytes: answer.bytes, mime: answer.mime });
    try {
      await rowsOf(session, storedRow, STORE, [
        answer.title,
        key,
        answer.uri,
        sha256,
        answer.mime,
        answer.day,
        JSON.stringify(answer.pages),
        EXTRACTOR,
        answer.kind,
        answer.provider ?? null,
      ]);
      status = 'stored';
    } catch (fault) {
      // A second caller stored the same bytes at the same instant.
      if (!isUniqueViolation(fault)) throw fault;
    }
    known = await knownOf(session, sha256);
    if (known === undefined) throw new Error('the door stored a document and no row holds it');
  }
  return { ...known, status };
};
