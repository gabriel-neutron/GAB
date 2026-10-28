import { createHash } from 'node:crypto';

import { readCsv } from '@gab/tools/csv';
import { z } from 'zod';

// The keys that join a reference to the record. A name never joins. The set is the unique keys of
// the duplicate check, with the identifiers of GEM, and without the IMO company number, which no
// chain step uses.
const JOIN_KEYS: readonly string[] = [
  'imo',
  'lei',
  'tax_id',
  'registration_number',
  'gem_entity_id',
  'gem_unit_id',
  'gem_project_id',
];

const named = { name: z.string().min(1) };

const field = z.union([
  z.strictObject({ ...named, attribute: z.string().min(1), min: z.int().min(1).optional() }),
  z.strictObject({ ...named, sources: z.int().min(1) }),
  z
    .strictObject({
      ...named,
      relation: z.string().min(1).optional(),
      end: z.enum(['from', 'to']).optional(),
      dated: z.literal(true).optional(),
    })
    .refine((one) => one.relation !== undefined || one.dated !== undefined, {
      message: 'give a relation, a dated flag or both',
    }),
]);

/** The file of the steps: for each step of the chain, the entity type, the reference (a CSV file of
 * `key,value` lines and the id of its stored document) or none, and the depth fields. A field is
 * an attribute (with the least number of distinct values), a number of stored sources, or a
 * relation. A relation field names the type, the end of the entity (`from` or `to`) and `dated`.
 * With no `dated`, a relation counts when it stands. With `dated`, it counts when it carries a
 * date, also when it ended. */
export const stepsShape = z
  .array(
    z.strictObject({
      ...named,
      type: z.string().min(1),
      reference: z
        .strictObject({ file: z.string().min(1), document: z.string().min(1) })
        .nullable(),
      fields: z.array(field),
    }),
  )
  .refine((steps) => new Set(steps.map((one) => one.name)).size === steps.length, {
    message: 'give each step its own name',
  });

export type Steps = z.infer<typeof stepsShape>;

/** The text of the files of a frozen release, and the text of the reference of each step by name. */
export interface AuditInput {
  readonly entities: string;
  readonly relations: string;
  readonly claims: string;
  readonly manifest: string;
  readonly references: ReadonlyMap<string, string>;
}

interface Share {
  readonly held: number;
  readonly of: number;
  readonly share: number | null;
}

export type StepReport =
  | { readonly name: string; readonly status: 'not measurable'; readonly type: string }
  | {
      readonly name: string;
      readonly status: 'measured';
      readonly type: string;
      readonly reference: { readonly document: string; readonly identifiers: number };
      readonly coverage: {
        readonly matched: number;
        readonly total: number;
        readonly share: number | null;
      };
      readonly depth: Readonly<Record<string, Share>>;
      readonly matched_entities: readonly string[];
      readonly unmatched_identifiers: readonly string[];
      readonly ambiguous_identifiers: readonly string[];
    };

export interface AuditReport {
  readonly release: { readonly sha256: string; readonly version: string | null };
  readonly steps: readonly StepReport[];
}

type Row = Readonly<Record<string, string>>;

// A file of a release starts with a preamble of lines that start with `#`. A column that the
// caller needs and the file lacks stops the audit: an empty value would give a false zero.
const table = (text: string, name: string, needs: readonly string[]): Row[] => {
  const rows = readCsv(text).filter(({ fields }) => !(fields[0] ?? '').startsWith('#'));
  const [head, ...body] = rows;
  const missing = needs.filter((one) => !head?.fields.includes(one));
  if (missing.length > 0)
    throw new Error(`The file ${name} lacks the column ${missing.join(', ')}`);
  return body.map(({ fields }) =>
    Object.fromEntries((head?.fields ?? []).map((one, at) => [one, fields[at] ?? ''])),
  );
};

const cell = (row: Row, column: string): string => row[column] ?? '';

// The normal form of the duplicate check of the record: no space and no dash, in capitals.
const normal = (held: unknown): string[] =>
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
  return normal(held);
};

const share = (part: number, total: number): number | null =>
  total === 0 ? null : Math.round((10000 * part) / total) / 10000;

const sorted = (list: Iterable<string>): string[] => [...list].sort();

interface Link {
  readonly type: string;
  readonly end: 'from' | 'to';
  readonly standing: boolean;
  readonly dated: boolean;
}

/** The relations of each entity, one link for each end. */
const linksOf = (relations: readonly Row[]): Map<string, Link[]> => {
  const links = new Map<string, Link[]>();
  for (const one of relations) {
    const base = {
      type: cell(one, 'type'),
      standing: cell(one, 'valid_to') === '',
      dated: cell(one, 'valid_from') !== '' || cell(one, 'valid_to') !== '',
    };
    for (const [id, end] of [
      [cell(one, 'from_id'), 'from'],
      [cell(one, 'to_id'), 'to'],
    ] as const) {
      links.set(id, [...(links.get(id) ?? []), { ...base, end }]);
    }
  }
  return links;
};

/** The distinct normal values of each attribute of each entity. A claim with more than one cited
 * source has more than one row, and it counts once. */
const attributesOf = (claims: readonly Row[]): Map<string, Map<string, Set<string>>> => {
  const attributes = new Map<string, Map<string, Set<string>>>();
  const seen = new Set<string>();
  for (const one of claims) {
    const at = cell(one, 'claim_id');
    if (cell(one, 'claim_kind') !== 'attribute' || cell(one, 'subject_kind') !== 'entity') continue;
    if (seen.has(at)) continue;
    seen.add(at);
    const held = attributes.get(cell(one, 'subject_id')) ?? new Map<string, Set<string>>();
    const values = held.get(cell(one, 'attribute')) ?? new Set<string>();
    for (const value of heldValues(cell(one, 'value'))) values.add(value);
    attributes.set(cell(one, 'subject_id'), held.set(cell(one, 'attribute'), values));
  }
  return attributes;
};

/** The identifiers of a reference, as `key:value`, keyed by the pair. */
const referenceOf = (text: string, step: string): Map<string, string> => {
  const [head, ...rows] = readCsv(text).filter(({ fields }) => !(fields[0] ?? '').startsWith('#'));
  if (head?.fields.join(',') !== 'key,value') {
    throw new Error(`The reference of the step ${step} must start with the header key,value`);
  }
  const wanted = new Map<string, string>();
  for (const { fields } of rows) {
    const key = fields[0] ?? '';
    if (!JOIN_KEYS.includes(key)) {
      throw new Error(
        `The reference of the step ${step} holds the key ${key}, which does not join`,
      );
    }
    for (const value of normal(fields[1] ?? ''))
      wanted.set(JSON.stringify([key, value]), `${key}:${value}`);
  }
  return wanted;
};

/** The coverage and the depth of each step on a frozen release. A reference identifier is matched
 * when an entity of the type of the step holds the same key and the same value in the normal form
 * of the duplicate check. An identifier that more than one entity holds is also listed as
 * ambiguous. A step with no reference is not measurable. Nothing depends on the time or on the
 * order of the rows, so two runs give the same report. */
export const auditCoverage = (input: AuditInput, steps: Steps): AuditReport => {
  const entities = table(input.entities, 'entities.csv', ['id', 'type', 'document_ids']);
  const links = linksOf(
    table(input.relations, 'relations.csv', ['type', 'from_id', 'to_id', 'valid_from', 'valid_to']),
  );
  const attributes = attributesOf(
    table(input.claims, 'claims.csv', [
      'claim_id',
      'claim_kind',
      'subject_kind',
      'subject_id',
      'attribute',
      'value',
    ]),
  );

  const measure = (step: Steps[number], reference: { document: string }): StepReport => {
    const ofType = entities.filter((one) => cell(one, 'type') === step.type);
    const holders = new Map<string, string[]>();
    for (const one of ofType) {
      for (const key of JOIN_KEYS) {
        for (const value of attributes.get(cell(one, 'id'))?.get(key) ?? []) {
          const at = JSON.stringify([key, value]);
          holders.set(at, [...(holders.get(at) ?? []), cell(one, 'id')]);
        }
      }
    }
    const wanted = referenceOf(input.references.get(step.name) ?? '', step.name);
    const matched = new Set<string>();
    const unmatched: string[] = [];
    const ambiguous: string[] = [];
    let hit = 0;
    for (const [at, name] of wanted) {
      const ids = holders.get(at) ?? [];
      if (ids.length === 0) unmatched.push(name);
      else hit += 1;
      if (ids.length > 1) ambiguous.push(name);
      for (const id of ids) matched.add(id);
    }
    const holds = (entity: Row, one: Steps[number]['fields'][number]): boolean => {
      const id = cell(entity, 'id');
      if ('attribute' in one)
        return (attributes.get(id)?.get(one.attribute)?.size ?? 0) >= (one.min ?? 1);
      if ('sources' in one) {
        return (
          cell(entity, 'document_ids')
            .split(' ')
            .filter((s) => s !== '').length >= one.sources
        );
      }
      return (links.get(id) ?? []).some(
        (link) =>
          (one.relation === undefined || link.type === one.relation) &&
          (one.end === undefined || link.end === one.end) &&
          (one.dated === undefined ? link.standing : link.dated),
      );
    };
    const depth = Object.fromEntries(
      step.fields.map((one) => {
        const held = ofType.filter(
          (entity) => matched.has(cell(entity, 'id')) && holds(entity, one),
        );
        return [
          one.name,
          { held: held.length, of: matched.size, share: share(held.length, matched.size) },
        ];
      }),
    );
    return {
      name: step.name,
      status: 'measured',
      type: step.type,
      reference: { document: reference.document, identifiers: wanted.size },
      coverage: { matched: hit, total: wanted.size, share: share(hit, wanted.size) },
      depth,
      matched_entities: sorted(matched),
      unmatched_identifiers: sorted(unmatched),
      ambiguous_identifiers: sorted(ambiguous),
    };
  };

  const manifest = z.object({ version: z.string().optional() }).parse(JSON.parse(input.manifest));
  return {
    release: {
      sha256: createHash('sha256').update(input.manifest, 'utf8').digest('hex'),
      version: manifest.version ?? null,
    },
    steps: steps.map((step) =>
      step.reference === null
        ? { name: step.name, status: 'not measurable', type: step.type }
        : measure(step, step.reference),
    ),
  };
};

const sortKeys = (_key: string, value: unknown): unknown =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([one], [two]) => (one < two ? -1 : 1)))
    : value;

/** The report as one JSON text with sorted keys, so two runs give the same bytes. */
export const auditText = (report: AuditReport): string =>
  `${JSON.stringify(report, sortKeys, 2)}\n`;
