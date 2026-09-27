import type { RawStore } from '@gab/store/bucket';
import { listKeys } from '@gab/store/listing';
import { z } from 'zod';

import type { Queryable } from './queryable.ts';

// A row with no key names no object: a source of kind url, api or report is purely external.
// Without the filter, the second list below reports the whole external corpus as broken.
const CITED = 'SELECT id, s3_key FROM public.documents WHERE s3_key IS NOT NULL';

const cited = z.array(z.object({ id: z.string().min(1), s3_key: z.string().min(1) }));

/** What the bucket and the index disagree on. Two empty lists say the two of them agree. */
export interface CorpusMismatch {
  readonly objectsWithNoRow: readonly string[];
  readonly rowsWithNoObject: readonly { readonly documentId: string; readonly key: string }[];
}

/** Reads the bucket against `documents` and answers the two lists. It repairs nothing. */
export const reconcileCorpus = async (on: Queryable, store: RawStore): Promise<CorpusMismatch> => {
  const rows = cited.parse((await on.query(CITED)).rows);
  const held = new Set(await listKeys(store));
  const named = new Set(rows.map((row) => row.s3_key));

  return {
    objectsWithNoRow: [...held].filter((key) => !named.has(key)),
    rowsWithNoObject: rows
      .filter((row) => !held.has(row.s3_key))
      .map((row) => ({ documentId: row.id, key: row.s3_key })),
  };
};
