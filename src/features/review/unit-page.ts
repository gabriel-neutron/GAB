import { z } from 'zod';

import type { Proposer } from '@/shared/read/model';

/** Where an element that an act names stands: it waits in the queue, the record holds it, the
 * operator rejected it, or neither holds it. */
export type EndState = 'pending' | 'record' | 'rejected' | 'missing';

/** One element that an act names, with its name where one is known. */
export interface UnitEnd {
  readonly id: string;
  readonly name: string | null;
  readonly state: EndState;
  /** The group of the act that waits, when the element waits in the queue. */
  readonly group: string | null;
  /** The day of the rejection, as YYYY-MM-DD, when the operator rejected the element. */
  readonly rejectedOn: string | null;
}

/** What one fault does to a unit: it blocks Promote; it holds Promote of this unit alone until an
 * entity of its own group is in the record; it keeps the unit out of a group action; or it is
 * information only. */
export type FaultLevel = 'blocks' | 'waits' | 'not_clean' | 'information';

// Departure: two exports, one job. The closed set of the faults is part of the shape of the page,
// and the filter of the queue offers the same set.

/** Each fault that the check of the database finds. */
export const FAULT_KINDS = [
  'end_waits',
  'circle',
  'end_relation_waits',
  'end_rejected',
  'end_missing',
  'self',
  'no_source',
  'end_waits_in_group',
  'dispute',
  'contradiction',
  'reported_claim',
  'duplicate',
  'unknown_type',
  'sources_from_parent',
  'approximate_position',
  'note',
  'same_name',
] as const;

export type FaultKind = (typeof FAULT_KINDS)[number];

/** One fault of a unit, with the sentence of the database. `act` names the act at fault, where
 * the fault is about one act. */
export interface Fault {
  readonly kind: FaultKind;
  readonly level: FaultLevel;
  readonly act: string | null;
  readonly said: string;
}

/** Clean: a group action can promote it. Not clean: the operator decides it alone. Blocked:
 * Promote cannot write it. */
export type UnitState = 'clean' | 'not_clean' | 'blocked';

/** One attribute of an act, each value as text. A list keeps each of its values. */
export interface Attribute {
  readonly key: string;
  readonly values: readonly string[];
}

interface ActBase {
  readonly id: string;
  readonly attributes: readonly Attribute[];
  /** A check disputes the act. The fault of the dispute gives its reason. */
  readonly disputed: boolean;
}

/** One act of a unit: a new entity, a new relation, or any other change. */
export type UnitAct =
  | (ActBase & { readonly kind: 'entity'; readonly label: string; readonly type: string })
  | (ActBase & {
      readonly kind: 'relation';
      readonly type: string;
      readonly src: UnitEnd;
      readonly dst: UnitEnd;
    })
  | (ActBase & { readonly kind: 'change'; readonly op: string; readonly target: UnitEnd | null });

/** The words of a page that an act cites, with up to two lines before and after them. */
export interface Passage {
  readonly act: string;
  readonly document: string;
  readonly page: number;
  readonly before: string;
  readonly text: string;
  readonly after: string;
}

export interface SourceDocument {
  readonly id: string;
  readonly title: string;
  readonly uri: string | null;
  readonly mime: string | null;
}

/** One unit of decision: an entity with the relations that depend on it, a relation between two
 * groups, or one other act. */
export interface Unit {
  readonly id: string;
  /** A link is a relation of a group whose end waits in another group; a relation is a single
   * relation with no group. */
  readonly kind: 'entity' | 'link' | 'relation' | 'change';
  readonly name: string;
  readonly type: string | null;
  readonly proposer: Proposer;
  readonly group: { readonly id: string; readonly subject: string | null } | null;
  readonly state: UnitState;
  /** The blocks first, then the waits, then the faults that are not clean, then the
   * information. */
  readonly faults: readonly Fault[];
  readonly acts: readonly UnitAct[];
  readonly documents: readonly SourceDocument[];
  readonly passages: readonly Passage[];
}

/** A group that the filter can choose, named by its subject. */
export interface GroupChoice {
  readonly id: string;
  readonly subject: string | null;
}

/** What the filters of the queue can choose: each group in the order of the queue, and each
 * document that a pending act cites. */
export interface FilterChoices {
  readonly groups: readonly GroupChoice[];
  readonly documents: readonly { readonly id: string; readonly title: string }[];
}

/** One page of the queue: the key it starts after, the key that opens the next page, the count
 * of every unit, the count of the units that the filter keeps, and how many of them come before
 * the page. */
export interface UnitPage {
  readonly units: readonly Unit[];
  readonly after: readonly string[] | null;
  readonly next: readonly string[] | null;
  readonly total: number;
  readonly matched: number;
  readonly before: number;
  readonly choices: FilterChoices;
}

const end = z
  .object({
    name: z.string().nullable(),
    state: z.enum(['pending', 'record', 'rejected', 'missing']),
    group: z.string().nullable(),
    rejectedOn: z.string().nullable().optional(),
  })
  .nullable();

const payload = z.object({
  label: z.string().optional(),
  type: z.string().optional(),
  src_id: z.string().optional(),
  dst_id: z.string().optional(),
  attrs: z.record(z.string(), z.object({ v: z.unknown() })).optional(),
  geom: z.object({ type: z.string(), coordinates: z.unknown() }).optional(),
  valid_from: z.string().nullable().optional(),
  valid_to: z.string().nullable().optional(),
});

const act = z.object({
  id: z.string(),
  op: z.string(),
  payload,
  targetId: z.string().nullable(),
  dissent: z.boolean(),
  target: end,
  src: end,
  dst: end,
});

const answer = z.object({
  total: z.number().int(),
  matched: z.number().int(),
  before: z.number().int(),
  next: z.array(z.string()).nullable(),
  choices: z.object({
    groups: z.array(z.object({ id: z.string(), subject: z.string().nullable() })),
    documents: z.array(z.object({ id: z.string(), title: z.string() })),
  }),
  units: z.array(
    z.object({
      unit: z.string(),
      kind: z.enum(['entity', 'link', 'relation', 'change']),
      name: z.string(),
      type: z.string().nullable(),
      proposer: z.enum(['extractor', 'research_ai', 'v1_import', 'operator']),
      group: z.object({ id: z.string(), subject: z.string().nullable() }).nullable(),
      state: z.enum(['clean', 'not_clean', 'blocked']),
      faults: z.array(
        z.object({
          kind: z.enum(FAULT_KINDS),
          level: z.enum(['blocks', 'waits', 'not_clean', 'information']),
          act: z.string().nullable(),
          said: z.string(),
        }),
      ),
      acts: z.array(act),
      documents: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          uri: z.string().nullable(),
          mime: z.string().nullable(),
        }),
      ),
      passages: z.array(
        z.object({
          act: z.string(),
          document: z.string(),
          page: z.number().int(),
          before: z.string(),
          text: z.string(),
          after: z.string(),
        }),
      ),
    }),
  ),
});

type ReadAct = z.output<typeof act>;

const textOf = (value: unknown): readonly string[] => {
  if (Array.isArray(value)) return value.flatMap(textOf);
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  return [JSON.stringify(value)];
};

const POINT = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]),
});

// A point is stored as longitude then latitude. The operator reads latitude first.
const attributesOf = (read: ReadAct['payload']): readonly Attribute[] => {
  const point = POINT.safeParse(read.geom);
  const dates = [
    ...(read.valid_from === null || read.valid_from === undefined
      ? []
      : [{ key: 'valid from', values: [read.valid_from] }]),
    ...(read.valid_to === null || read.valid_to === undefined
      ? []
      : [{ key: 'valid to', values: [read.valid_to] }]),
  ];
  return [
    ...(point.success
      ? [
          {
            key: 'position',
            values: [`${String(point.data.coordinates[1])}, ${String(point.data.coordinates[0])}`],
          },
        ]
      : read.geom === undefined
        ? []
        : [{ key: 'shape', values: [read.geom.type] }]),
    ...dates,
    ...Object.entries(read.attrs ?? {}).map(([key, held]) => ({ key, values: textOf(held.v) })),
  ];
};

// The read names no element that the record and the queue both lack, so it reads as missing.
const endOf = (id: string, read: z.output<typeof end>): UnitEnd => ({
  id,
  name: read?.name ?? null,
  state: read?.state ?? 'missing',
  group: read?.group ?? null,
  rejectedOn: read?.rejectedOn ?? null,
});

const actOf = (read: ReadAct): UnitAct => {
  const base = {
    id: read.id,
    attributes: attributesOf(read.payload),
    disputed: read.dissent,
  };
  if (read.op === 'create_entity')
    return {
      ...base,
      kind: 'entity',
      label: read.payload.label ?? '',
      type: read.payload.type ?? '',
    };
  if (read.op === 'create_relation')
    return {
      ...base,
      kind: 'relation',
      type: read.payload.type ?? '',
      src: endOf(read.payload.src_id ?? '', read.src),
      dst: endOf(read.payload.dst_id ?? '', read.dst),
    };
  return {
    ...base,
    kind: 'change',
    op: read.op,
    target: read.targetId === null ? null : endOf(read.targetId, read.target),
  };
};

/** The page of the queue that the writer gave after the key `after`, checked at the edge. Null
 * where the answer is not a page. */
export function unitPageOf(raw: unknown, after: readonly string[] | null): UnitPage | null {
  const read = answer.safeParse(raw);
  if (!read.success) return null;
  return {
    after,
    total: read.data.total,
    matched: read.data.matched,
    before: read.data.before,
    choices: read.data.choices,
    next: read.data.next,
    units: read.data.units.map((unit) => ({
      id: unit.unit,
      kind: unit.kind,
      name: unit.name,
      type: unit.type,
      proposer: unit.proposer,
      group: unit.group,
      state: unit.state,
      faults: unit.faults,
      acts: unit.acts.map(actOf),
      documents: unit.documents,
      passages: unit.passages,
    })),
  };
}
