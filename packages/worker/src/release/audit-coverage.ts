import { createHash } from 'node:crypto';

import { readCsv } from '@gab/tools/csv';
import { z } from 'zod';

/** The keys that join a reference to the record. A name never joins. */
export const JOIN_KEYS = [
  'imo',
  'lei',
  'tax_id',
  'registration_number',
  'gem_entity_id',
  'gem_unit_id',
  'gem_project_id',
] as const;

const field = z.union([
  z.strictObject({
    name: z.string().min(1),
    attribute: z.string().min(1),
    min: z.int().min(1).optional(),
  }),
  z.strictObject({ name: z.string().min(1), sources: z.int().min(1) }),
  z
    .strictObject({
      name: z.string().min(1),
      relation: z.string().min(1).optional(),
      dated: z.literal(true).optional(),
    })
    .refine((one) => one.relation !== undefined || one.dated !== undefined, {
      message: 'give a relation, a dated flag or both',
    }),
]);

/** The file of the steps: for each step of the chain, the entity type, the reference (a CSV file of
 * `key,value` lines and the id of its stored document) or none, and the depth fields. */
export const stepsShape = z.array(
  z.strictObject({
    name: z.string().min(1),
    type: z.string().min(1),
    reference: z.strictObject({ file: z.string().min(1), document: z.string().min(1) }).nullable(),
    fields: z.array(field),
  }),
);

export type Steps = z.infer<typeof stepsShape>;

/** The text of the files of a frozen release, and the text of the reference of each step by name. */
export interface AuditInput {
  readonly entities: string;
  readonly relations: string;
  readonly claims: string;
  readonly manifest: string;
  readonly references: ReadonlyMap<string, string>;
}

// A file of a release starts with a preamble of lines that start with `#`.
type Column =
  | 'id'
  | 'type'
  | 'document_ids'
  | 'from_id'
  | 'to_id'
  | 'valid_from'
  | 'valid_to'
  | 'claim_id'
  | 'claim_kind'
  | 'subject_kind'
  | 'subject_id'
  | 'attribute'
  | 'value';
type Row = Partial<Record<Column, string>>;

const table = (text: string): Row[] => {
  const rows = readCsv(text).filter(({ fields }) => !(fields[0] ?? '').startsWith('#'));
  const [head, ...body] = rows;
  if (head === undefined) return [];
  return body.map(({ fields }) =>
    Object.fromEntries(head.fields.map((n, at) => [n, fields[at] ?? ''])),
  );
};

// The normal form of the duplicate check of the record (packages/tools/src/duplicate-identifier.ts):
// no space and no dash, in capitals.
const valuesOf = (held: unknown): string[] =>
  (Array.isArray(held) ? held : [held])
    .filter((one): one is string | number => typeof one === 'string' || typeof one === 'number')
    .map((one) => String(one).replace(/[\s-]/gu, '').toUpperCase())
    .filter((one) => one !== '');

// The value of a list is written as JSON in the claims file.
const heldValues = (text: string): string[] => {
  let held: unknown = text;
  if (text.startsWith('[')) {
    try {
      held = JSON.parse(text);
    } catch {
      held = text;
    }
  }
  return valuesOf(held);
};

const share = (part: number, total: number): number | null =>
  total === 0 ? null : Math.round((10000 * part) / total) / 10000;

const sorted = (list: Iterable<string>): string[] => [...list].sort();

/** The coverage and the depth of each step on a frozen release, as an object. A reference identifier
 * is matched when an entity of the type of the step holds the same key and the same value after the
 * normal form of the duplicate check. A step with no reference is not measurable. Nothing depends
 * on the time or the order of the files, so two runs give the same object. */
export const auditCoverage = (input: AuditInput, steps: Steps): Record<string, unknown> => {
  const entities = table(input.entities);
  const relations = table(input.relations).filter((one) => one.valid_to === '');
  const dated = new Set<string>();
  const touching = new Map<string, Set<string>>();
  for (const one of table(input.relations)) {
    if (one.valid_from !== '' || one.valid_to !== '') {
      dated.add(one.from_id ?? '');
      dated.add(one.to_id ?? '');
    }
  }
  for (const one of relations) {
    for (const id of [one.from_id ?? '', one.to_id ?? '']) {
      const types = touching.get(id) ?? new Set<string>();
      touching.set(id, types.add(one.type ?? ''));
    }
  }
  // The held values of each entity, one claim once, and the identifiers among them.
  const attributes = new Map<string, Map<string, Set<string>>>();
  const seen = new Set<string>();
  for (const one of table(input.claims)) {
    const at = one.claim_id ?? '';
    if (one.claim_kind !== 'attribute' || one.subject_kind !== 'entity' || seen.has(at)) continue;
    seen.add(at);
    const held = attributes.get(one.subject_id ?? '') ?? new Map<string, Set<string>>();
    const values = held.get(one.attribute ?? '') ?? new Set<string>();
    for (const value of heldValues(one.value ?? '')) values.add(value);
    attributes.set(one.subject_id ?? '', held.set(one.attribute ?? '', values));
  }

  const results = steps.map((step) => {
    if (step.reference === null)
      return { name: step.name, status: 'not measurable', type: step.type };
    const ofType = entities.filter((one) => one.type === step.type);
    const holder = new Map<string, string[]>();
    for (const one of ofType) {
      for (const key of JOIN_KEYS) {
        for (const value of attributes.get(one.id ?? '')?.get(key) ?? []) {
          const at = JSON.stringify([key, value]);
          holder.set(at, [...(holder.get(at) ?? []), one.id ?? '']);
        }
      }
    }
    const wanted = new Map<string, string>();
    const text = input.references.get(step.name) ?? '';
    const [head, ...rows] = readCsv(text).filter(
      ({ fields }) => !(fields[0] ?? '').startsWith('#'),
    );
    if (head?.fields.join(',') !== 'key,value')
      throw new Error(
        `The reference of the step ${step.name} must start with the header key,value`,
      );
    for (const { fields } of rows) {
      const key = fields[0] ?? '';
      if (!(JOIN_KEYS as readonly string[]).includes(key))
        throw new Error(
          `The reference of the step ${step.name} holds the key ${key}, which does not join`,
        );
      for (const value of valuesOf(fields[1] ?? ''))
        wanted.set(JSON.stringify([key, value]), `${key}:${value}`);
    }
    const matched = new Set<string>();
    const unmatched: string[] = [];
    let hit = 0;
    for (const [at, name] of wanted) {
      const ids = holder.get(at);
      if (ids === undefined) unmatched.push(name);
      else {
        hit += 1;
        for (const id of ids) matched.add(id);
      }
    }
    const depth = Object.fromEntries(
      step.fields.map((one) => {
        const held = ofType.filter((entity) => {
          if (!matched.has(entity.id ?? '')) return false;
          if ('attribute' in one)
            return (
              (attributes.get(entity.id ?? '')?.get(one.attribute)?.size ?? 0) >= (one.min ?? 1)
            );
          if ('sources' in one)
            return (
              (entity.document_ids ?? '').split(' ').filter((s) => s !== '').length >= one.sources
            );
          const types = touching.get(entity.id ?? '');
          const related =
            one.relation === undefined
              ? (types?.size ?? 0) > 0
              : (types?.has(one.relation) ?? false);
          return related && (one.dated === undefined || dated.has(entity.id ?? ''));
        }).length;
        return [one.name, { held, of: matched.size, share: share(held, matched.size) }];
      }),
    );
    return {
      name: step.name,
      status: 'measured',
      type: step.type,
      reference: { document: step.reference.document, identifiers: wanted.size },
      coverage: { matched: hit, total: wanted.size, share: share(hit, wanted.size) },
      depth,
      matched_entities: sorted(matched),
      unmatched_identifiers: sorted(unmatched),
    };
  });
  const manifest = JSON.parse(input.manifest) as { version?: string };
  return {
    release: {
      sha256: createHash('sha256').update(input.manifest, 'utf8').digest('hex'),
      version: manifest.version ?? null,
    },
    steps: results,
  };
};

const sortKeys = (_key: string, value: unknown): unknown =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([one], [two]) => (one < two ? -1 : 1)))
    : value;

/** The report as one JSON text with sorted keys, so two runs give the same bytes. */
export const auditText = (report: Record<string, unknown>): string =>
  `${JSON.stringify(report, sortKeys, 2)}\n`;
