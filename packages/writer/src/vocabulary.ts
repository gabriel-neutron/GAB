import { attributeVocabulary, type AttributeVocabulary } from '@gab/proposal/vocabulary';
import type { Pool } from 'pg';

const READ = 'SELECT key, kind, pattern, retired FROM public.attribute_key';

/** The live vocabulary, and one re-read when a key arrives that the snapshot does not hold. */
export interface VocabularyReader {
  readonly forKeys: (keys: readonly string[]) => Promise<AttributeVocabulary>;
}

const read = async (pool: Pool): Promise<AttributeVocabulary> =>
  attributeVocabulary.parse((await pool.query<Record<string, unknown>>(READ)).rows);

// The seed that declares a key is edited routinely, so the snapshot is taken at startup and
// re-read on a key it does not hold. A copy in TypeScript would be a second source of truth.
export const openVocabulary = async (pool: Pool): Promise<VocabularyReader> => {
  let held = await read(pool);
  return {
    forKeys: async (keys) => {
      const known = new Set(held.map((entry) => entry.key));
      if (keys.every((key) => known.has(key))) return held;
      held = await read(pool);
      return held;
    },
  };
};
