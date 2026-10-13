import { identifierContainment, type IdentifierKey } from '@gab/proposal/identifiers';
import type { Cast, LookupKey } from '@gab/proposal/mapping';
import type { CsvRecord } from '@gab/tools/csv';
import { z } from 'zod';

import type { Queryable } from '../queryable.ts';
import { castCell } from './cast.ts';

// The fixed order of the lookup. An identifier that a list shares with the record finds a hull
// before a name does, and a name alone is the last way. A GEM identifier names one row of a
// tracker, then a register number names one company, then a code names one place.
const FIRST_KEYS: readonly LookupKey[] = [
  'imo',
  'opensanctions_id',
  'gem_entity_id',
  'gem_unit_id',
  'gem_project_id',
  'tax_id',
  'registration_number',
  'lei',
  'unlocode',
  'osm_id',
];

/** The lookups of a mapping in the order that code tries them: the first keys in their fixed
 * order, then each other identifier in the order of the mapping, then the name. */
export const lookupOrder = <T extends { readonly key: LookupKey }>(given: readonly T[]): T[] => [
  ...FIRST_KEYS.flatMap((key) => given.filter((one) => one.key === key)),
  ...given.filter((one) => !FIRST_KEYS.includes(one.key) && one.key !== 'label'),
  ...given.filter((one) => one.key === 'label'),
];

const BY_IDENTIFIER = `SELECT id::text AS id FROM api.entity
  WHERE attrs @> ANY($1::jsonb[]) AND ($2::text IS NULL OR type = $2::text)
  ORDER BY id LIMIT 20`;

const BY_LABEL = `SELECT id::text AS id FROM api.entity
  WHERE type = $1::text AND lower(label) = lower($2::text) ORDER BY id LIMIT 20`;

const idRows = z.array(z.object({ id: z.uuid() }));

const foundOf = (ids: readonly string[], key: LookupKey): Found => {
  const [first] = ids;
  if (ids.length > 1) return { kind: 'many', key, count: ids.length };
  return first === undefined ? { kind: 'none' } : { kind: 'one', id: first, key };
};

/** What a lookup finds: no entity, one entity and the key that found it, or more than one. */
export type Found =
  | { readonly kind: 'none' }
  | { readonly kind: 'one'; readonly id: string; readonly key: LookupKey }
  | { readonly kind: 'many'; readonly key: string; readonly count: number };

interface Lookup {
  readonly key: LookupKey;
  readonly column: string;
}

/** The casts of the columns that a mapping reads, by attribute key. A lookup reads its cell under
 * the cast of the same key and the same column. */
export type ColumnCasts = Readonly<
  Record<string, { readonly column: string; readonly cast: Cast } | undefined>
>;

/** Finds an entity of a row of a table under a mapping: the entity of the row, or an end of a
 * relation. `entityType` is the type that a lookup by the name finds. It reads the record and
 * writes nothing, so the load and the dry join give the same answer for the same row. */
export const makeFinder = (
  db: Queryable,
  casts: ColumnCasts,
  header: readonly string[],
): ((record: CsvRecord, given: readonly Lookup[], entityType: string) => Promise<Found>) => {
  const column = new Map(header.map((name, index) => [name, index] as const));

  // A lookup reads its cell as the attribute of the same key and the same column reads it. So a
  // tax number that lost its leading zero finds the company, and "not found" is no LEI.
  const valueOf = (record: CsvRecord, lookup: Lookup): string | null => {
    const text = (record.fields[column.get(lookup.column) ?? -1] ?? '').trim();
    if (text === '') return null;
    const rule = lookup.key === 'label' ? undefined : casts[lookup.key];
    // A LEI is checked even in a column that fills no attribute.
    const cast =
      rule?.column === lookup.column
        ? rule.cast
        : lookup.key === 'lei'
          ? ({ type: 'identifier' } as const)
          : undefined;
    if (cast === undefined) return text;
    const cell = castCell(cast, lookup.key, text);
    if (cell.ok !== true) return null;
    return typeof cell.value === 'string' ? cell.value : text;
  };

  const lookedUp = async (lookup: Lookup, value: string, entityType: string): Promise<Found> => {
    if (lookup.key === 'label') {
      const { rows } = await db.query(BY_LABEL, [entityType, value]);
      return foundOf(
        idRows.parse(rows).map((held) => held.id),
        lookup.key,
      );
    }
    return findByIdentifier(db, lookup.key, value, null);
  };

  return async (record, given, entityType) => {
    for (const one of lookupOrder(given)) {
      const value = valueOf(record, one);
      if (value === null) continue;
      const found = await lookedUp(one, value, entityType);
      if (found.kind !== 'none') return found;
    }
    return { kind: 'none' };
  };
};

/** Finds the entities that hold one identifier, with no mapping and no column. `entityType` limits
 * the lookup to one type, and null looks at every type. */
export const findByIdentifier = async (
  db: Queryable,
  key: IdentifierKey,
  value: string,
  entityType: string | null,
): Promise<Found> => {
  const { rows } = await db.query(BY_IDENTIFIER, [
    identifierContainment(key, value).map((shape) => JSON.stringify(shape)),
    entityType,
  ]);
  return foundOf(
    idRows.parse(rows).map((held) => held.id),
    key,
  );
};
