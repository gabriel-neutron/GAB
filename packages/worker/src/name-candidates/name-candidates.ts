import { z } from 'zod';

import type { Queryable } from '../queryable.ts';
import { candidatePairs } from './candidate-pairs.ts';

// The label of each entity, and each text of the attributes that hold its other names. A value
// can be one text or a list of texts.
const NAMES = `
  SELECT e.id AS entity_id, e.type, e.label AS name FROM public.entities e
  UNION ALL
  SELECT e.id, e.type, n.value #>> '{}'
    FROM public.entities e
   CROSS JOIN unnest(ARRAY['former_names', 'aliases', 'label_cyrillic']) AS k(key)
   CROSS JOIN LATERAL jsonb_array_elements(
           CASE WHEN jsonb_typeof(e.attrs->k.key->'v') = 'array' THEN e.attrs->k.key->'v'
                ELSE jsonb_build_array(e.attrs->k.key->'v') END) AS n(value)
   WHERE e.attrs ? k.key AND jsonb_typeof(n.value) = 'string'`;

const STORE = 'SELECT added, kept, dropped FROM public.store_name_candidates($1::jsonb)';

const nameRow = z.object({ entity_id: z.uuid(), type: z.string(), name: z.string() });

const storedRow = z.object({
  added: z.number().int(),
  kept: z.number().int(),
  dropped: z.number().int(),
});

/** What one run found and stored. */
export interface CandidateRun {
  readonly names: number;
  readonly found: number;
  /** The pairs that no row named before. */
  readonly added: number;
  /** The pairs that a row names already: waiting, confirmed or refused. */
  readonly kept: number;
  /** The pairs that waited and that this run did not find again. */
  readonly dropped: number;
}

/** Reads each name of the record, finds the pairs of one type with one transliteration key in a
 * Latin and a Cyrillic name, and stores them for the operator. A pair that the operator refused or
 * confirmed is never proposed again. The caller gives one transaction. */
export const findNameCandidates = async (db: Queryable): Promise<CandidateRun> => {
  const names = z
    .array(nameRow)
    .parse((await db.query(NAMES)).rows)
    .map((row) => ({ entityId: row.entity_id, type: row.type, name: row.name }));
  const pairs = candidatePairs(names);
  const body = pairs.map((pair) => ({
    first_id: pair.firstId,
    second_id: pair.secondId,
    key: pair.key,
    first_name: pair.firstName,
    second_name: pair.secondName,
  }));
  const [stored] = z.array(storedRow).parse((await db.query(STORE, [JSON.stringify(body)])).rows);
  if (stored === undefined) throw new Error('the database stored no pair and gave no count');
  return { names: names.length, found: pairs.length, ...stored };
};
