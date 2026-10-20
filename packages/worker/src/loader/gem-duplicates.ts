import { z } from 'zod';

import { nameKey } from '../name-key.ts';
import type { Queryable } from '../queryable.ts';

// Origin of the number: decided with the panel. A GEM point and a dossier point of one field lie within a
// few km. Closeness alone proves nothing, so a name test follows.
const NEAR_METRES = 10_000;

// The generic words of a name of a field. They are not part of the name of the place.
const GENERIC = /\b(?:oil and gas|field|deposit)\b|\(russia\)/gu;

/** The words that name the place, with the generic words removed. A hyphen joins words, so
 * "Yuzhno-Kirinskoye" is one word and is not the word "Kirinskoye". */
const placeWords = (name: string): readonly string[] =>
  nameKey(name).replace(GENERIC, ' ').split(' ').filter(Boolean);

const holds = (whole: readonly string[], part: readonly string[]): boolean =>
  part.length > 0 &&
  whole.some((_, from) => part.every((word, offset) => whole[from + offset] === word));

/** True when two names are one name: the same key in the record, or after the generic words go, the
 * words of one name stand whole in the other. */
export const similarName = (a: string, b: string): boolean => {
  if (nameKey(a) === nameKey(b)) return true;
  const [x, y] = [placeWords(a), placeWords(b)];
  return holds(x, y) || holds(y, x);
};

// A point of a loaded GEM unit and a point of a dossier facility of the same type with no GEM key.
const NEAR = `SELECT g.id::text AS gem_id, g.label AS gem_label, d.id::text AS dossier_id,
       d.label AS dossier_label, g.type,
       ST_Distance(g.geom::geography, d.geom::geography) AS metres
  FROM public.entities g
  JOIN public.entities d ON d.type = g.type AND d.id <> g.id AND NOT d.attrs ?| ARRAY['gem_unit_id', 'gem_project_id', 'gem_entity_id']
   AND ST_DWithin(g.geom::geography, d.geom::geography, $1::float8)
 WHERE g.attrs ? 'gem_unit_id' AND GeometryType(g.geom) = 'POINT' AND GeometryType(d.geom) = 'POINT'
 ORDER BY g.id, d.id`;

const rows = z.array(
  z.object({
    gem_id: z.uuid(),
    gem_label: z.string(),
    dossier_id: z.uuid(),
    dossier_label: z.string(),
    type: z.string(),
    metres: z.number(),
  }),
);

/** A candidate pair of one entity with a GEM unit key and one without it. */
export interface GemDuplicate {
  readonly gemId: string;
  readonly gemLabel: string;
  readonly dossierId: string;
  readonly dossierLabel: string;
  readonly type: string;
  readonly metres: number;
}

/** The pairs of entities of one type, one with the key gem_unit_id and one without a GEM key, with a point
 * within 10 km and a similar name. It reads the record and writes nothing. The operator merges a
 * true pair with merge_entities. */
export const gemDuplicates = async (db: Queryable): Promise<readonly GemDuplicate[]> =>
  rows
    .parse((await db.query(NEAR, [NEAR_METRES])).rows)
    .filter((row) => similarName(row.gem_label, row.dossier_label))
    .map((row) => ({
      gemId: row.gem_id,
      gemLabel: row.gem_label,
      dossierId: row.dossier_id,
      dossierLabel: row.dossier_label,
      type: row.type,
      metres: Math.round(row.metres),
    }));
