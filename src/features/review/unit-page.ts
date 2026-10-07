import { z } from 'zod';

import type { Proposer } from '@/shared/read/model';

/** Where an element that an act names stands: it waits in the queue, the record holds it, or
 * neither holds it. */
export type EndState = 'pending' | 'record' | 'missing';

/** One element that an act names, with its name where one is known. */
export interface UnitEnd {
  readonly id: string;
  readonly name: string | null;
  readonly state: EndState;
  /** The group of the act that waits, when the element waits in the queue. */
  readonly group: string | null;
}

/** One attribute of an act, each value as text. A list keeps each of its values. */
export interface Attribute {
  readonly key: string;
  readonly values: readonly string[];
}

interface ActBase {
  readonly id: string;
  readonly attributes: readonly Attribute[];
  /** Why a check disputes the act. Null where no check disputes it. */
  readonly dispute: string | null;
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
  readonly acts: readonly UnitAct[];
  readonly documents: readonly SourceDocument[];
  readonly passages: readonly Passage[];
}

/** One page of the queue, the key that opens the next page, and the count of every unit. */
export interface UnitPage {
  readonly units: readonly Unit[];
  readonly next: readonly string[] | null;
  readonly total: number;
}

const end = z
  .object({
    name: z.string().nullable(),
    state: z.enum(['pending', 'record', 'missing']),
    group: z.string().nullable(),
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
  dissentReason: z.string().nullable(),
  target: end,
  src: end,
  dst: end,
});

const answer = z.object({
  total: z.number().int(),
  next: z.array(z.string()).nullable(),
  units: z.array(
    z.object({
      unit: z.string(),
      kind: z.enum(['entity', 'link', 'relation', 'change']),
      name: z.string(),
      type: z.string().nullable(),
      proposer: z.enum(['extractor', 'research_ai', 'v1_import', 'operator']),
      group: z.object({ id: z.string(), subject: z.string().nullable() }).nullable(),
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
});

const actOf = (read: ReadAct): UnitAct => {
  const base = {
    id: read.id,
    attributes: attributesOf(read.payload),
    dispute: read.dissentReason,
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

/** The page of the queue that the writer gave, checked at the edge. Null where the answer is not
 * a page. */
export function unitPageOf(raw: unknown): UnitPage | null {
  const read = answer.safeParse(raw);
  if (!read.success) return null;
  return {
    total: read.data.total,
    next: read.data.next,
    units: read.data.units.map((unit) => ({
      id: unit.unit,
      kind: unit.kind,
      name: unit.name,
      type: unit.type,
      proposer: unit.proposer,
      group: unit.group,
      acts: unit.acts.map(actOf),
      documents: unit.documents,
      passages: unit.passages,
    })),
  };
}
