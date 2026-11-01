import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import { z } from 'zod';

import type { Queryable } from './queryable.ts';

const STORED = `SELECT sha256, s3_key FROM public.documents WHERE id::text = $1`;

const storedRow = z.object({ sha256: z.string().nullable(), s3_key: z.string().nullable() });

export interface DocumentFileDeps {
  readonly db: Queryable;
  /** The bytes of one object of the raw store. */
  readonly read: (key: string) => Promise<Uint8Array>;
}

/** Writes the bytes of one stored document to a new file, as stored. It checks the bytes against
 * the stored hash first, and refuses a file that exists. It gives the hash. */
export const writeDocumentFile = async (
  deps: DocumentFileDeps,
  document: string,
  out: string,
): Promise<string> => {
  const [row] = z.array(storedRow).parse((await deps.db.query(STORED, [document])).rows);
  if (row === undefined) throw new Error(`Document ${document} is not stored.`);
  if (row.s3_key === null) throw new Error(`Document ${document} has no stored file.`);
  const bytes = await deps.read(row.s3_key);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (row.sha256 === null) throw new Error(`Document ${document} has no stored hash to check.`);
  if (row.sha256 !== sha256)
    throw new Error(`The bytes of document ${document} do not match its stored hash.`);
  // The flag "wx" fails when the file exists, so no file is overwritten.
  await writeFile(out, bytes, { flag: 'wx' });
  return sha256;
};
