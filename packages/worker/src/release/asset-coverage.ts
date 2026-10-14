import { z } from 'zod';

import type { Queryable } from '../queryable.ts';
import { assetKinds, attributeOfEntities } from './asset-claims.ts';
import { readReleaseRecord, type ReleaseRecord } from './release-record.ts';

/** The total capacity of one kind, with the attribute that holds the capacity of an asset and the
 * source of the total. A total with no source is refused, so a share never rests on a number that
 * nobody can check. */
const totalShape = z.strictObject({
  attribute: z.string().min(1),
  total: z.number().positive(),
  unit: z.string().min(1),
  source: z.string().min(1),
});

/** The file of the totals: one entry for each kind of asset that has a total. */
export const totalsShape = z.record(z.string(), totalShape);

export type CapacityTotals = z.infer<typeof totalsShape>;

// A relation of the sanctions family (ADR 0017) between an asset and a regime act or a list.
const SANCTIONS = new Set(['designated_by', 'restricted_by']);

interface Measure {
  readonly name: string;
  readonly has: (assetId: string) => boolean;
}

const capacityOf = (value: unknown): number => {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number >= 0 ? number : 0;
};

const percent = (part: number, total: number): string => `${((100 * part) / total).toFixed(1)}%`;

/** The coverage of each kind of asset as lines of tab-separated columns: a heading, then one line
 * for each kind in the order of its name. A line gives the number of assets, and the number that
 * have a geometry, an operator, an owner and a sanctions relation. When `totals` names the kind,
 * each number is followed by the share of the total capacity that those assets hold, and the line
 * ends with the total and its source. A relation that has ended does not count. An asset has an
 * operator when a relation of the `operates` type stands on it, an owner when a relation of the
 * `owns` type stands on it, and a sanctions relation when it is the first end of a `designated_by`
 * or a `restricted_by` relation. */
export const assetCoverageLines = (
  record: ReleaseRecord,
  totals: CapacityTotals,
): readonly string[] => {
  const kinds = assetKinds(record);
  const geometry = new Set(record.entities.filter((one) => one.geom !== null).map((one) => one.id));
  const standing = record.relations.filter((one) => one.valid_to === null);
  const touching = (types: ReadonlySet<string>): ReadonlySet<string> =>
    new Set(standing.flatMap((one) => (types.has(one.type) ? [one.src_id, one.dst_id] : [])));
  const operated = touching(new Set(['operates']));
  const owned = touching(new Set(['owns']));
  const sanctioned = new Set(
    standing.flatMap((one) => (SANCTIONS.has(one.type) ? [one.src_id] : [])),
  );
  const measures: readonly Measure[] = [
    { name: 'geometry', has: (id) => geometry.has(id) },
    { name: 'operator', has: (id) => operated.has(id) },
    { name: 'owner', has: (id) => owned.has(id) },
    { name: 'sanctions relation', has: (id) => sanctioned.has(id) },
  ];
  const byKind = new Map<string, string[]>();
  for (const [id, kind] of kinds) byKind.set(kind, [...(byKind.get(kind) ?? []), id]);

  const lines = [
    [
      'kind',
      'assets',
      ...measures.map((one) => `with ${one.name}`),
      'total capacity',
      'source of the total',
    ].join('\t'),
  ];
  for (const [kind, ids] of [...byKind].sort(([one], [two]) => one.localeCompare(two))) {
    const total = totals[kind];
    const capacities =
      total === undefined
        ? new Map<string, number>()
        : new Map(
            [...attributeOfEntities(record, total.attribute)].map(([id, value]) => [
              id,
              capacityOf(value),
            ]),
          );
    const cell = (held: readonly string[]): string => {
      if (total === undefined) return String(held.length);
      const capacity = held.reduce((sum, id) => sum + (capacities.get(id) ?? 0), 0);
      return `${String(held.length)} (${percent(capacity, total.total)} of capacity)`;
    };
    lines.push(
      [
        kind,
        cell(ids),
        ...measures.map((one) => cell(ids.filter(one.has))),
        total === undefined ? 'unknown' : `${String(total.total)} ${total.unit}`,
        total === undefined ? 'none given' : total.source,
      ].join('\t'),
    );
  }
  return lines;
};

/** The coverage report of the assets, as the release reads the record. The caller gives one
 * snapshot for the reads. */
export const assetCoverageReport = async (
  db: Queryable,
  totals: CapacityTotals,
): Promise<readonly string[]> =>
  assetCoverageLines(await readReleaseRecord(db, { natoPair: false }), totals);
