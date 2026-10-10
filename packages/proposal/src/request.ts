import { z } from 'zod';

import { attributeEdit } from './attribute-value.ts';

/** The six acts the operator may sign. A merge and its undo have doors of their own. */
export const WRITE_OPS = [
  'create_entity',
  'create_relation',
  'update_attrs',
  'update_entity',
  'delete_entity',
  'delete_relation',
] as const;

/** The three decisions the operator takes on what waits in the queue. A write makes a proposal
 * and signs it; a decision writes no proposal and names a unit, or one relation of it. */
export const DECISION_OPS = ['promote_unit', 'reject_unit', 'reject_relation'] as const;

export type DecisionOp = (typeof DECISION_OPS)[number];

/** The two merge doors of the operator. Each one writes its act and promotes it at once. */
export const MERGE_OPS = ['merge_entities', 'undo_merge'] as const;

export type MergeOp = (typeof MERGE_OPS)[number];

/** The body of each merge door. A merge names the entity that stays and the entity that it
 * absorbs. An undo names the absorbed entity alone, and the record finds its merge. */
export const mergeRequest = {
  merge_entities: z.strictObject({ survivorId: z.uuid(), absorbedId: z.uuid() }),
  undo_merge: z.strictObject({ absorbedId: z.uuid() }),
} as const satisfies Readonly<Record<MergeOp, z.ZodType>>;

// The reason and the note are a shape here. The database holds the list of reasons and the rule
// on the note, and it words its own refusal.
const rejection = { reason: z.string(), note: z.string().optional() };

/** The body of each decision. */
export const decisionRequest = {
  promote_unit: z.strictObject({ unitId: z.uuid() }),
  reject_unit: z.strictObject({ unitId: z.uuid(), ...rejection }),
  reject_relation: z.strictObject({ proposalId: z.uuid(), ...rejection }),
} as const satisfies Readonly<Record<DecisionOp, z.ZodType>>;

// Origin of the number: the largest group of the v1 import holds 104 units, and a group of more
// than 1,000 units is no screen that the operator reads before one confirmation.
const MOST_GROUP_UNITS = 1000;

/** The body of the group action: the group, and the units of it that the screen showed. */
export const groupActionRequest = z.strictObject({
  groupId: z.uuid(),
  unitIds: z.array(z.uuid()).min(1).max(MOST_GROUP_UNITS),
});

/** One decision, as the caller states it. */
export type Decision = {
  readonly [Op in DecisionOp]: { readonly op: Op } & z.input<(typeof decisionRequest)[Op]>;
}[DecisionOp];

const endpointKind = z.enum(['entity', 'relation']);

// THE SHAPE OF A REQUEST, AND NO RULE OF THE RECORD. The database holds each rule on a value: a
// blank name, the order and the scope of an interval, a day of the calendar, the length of a
// type, a position on the globe, the shape of an attribute key. It words its own refusal.
const position = z.array(z.number());
const positions = z.array(position);

const geometry = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('Point'), coordinates: position }),
  z.strictObject({ type: z.literal('MultiPoint'), coordinates: positions }),
  z.strictObject({ type: z.literal('LineString'), coordinates: positions }),
  z.strictObject({ type: z.literal('MultiLineString'), coordinates: z.array(positions) }),
  z.strictObject({ type: z.literal('Polygon'), coordinates: z.array(positions) }),
  z.strictObject({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(positions)) }),
]);

/** The body of one write, with the act taken from the address and never from the caller. */
export const writeRequest = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('create_entity'),
    type: z.string().trim(),
    label: z.string().trim(),
    geom: geometry.optional(),
    attrs: attributeEdit.optional(),
  }),

  z.strictObject({
    op: z.literal('create_relation'),
    type: z.string().trim(),
    srcKind: endpointKind.default('entity'),
    srcId: z.uuid(),
    dstKind: endpointKind.default('entity'),
    dstId: z.uuid(),
    validFrom: z.string().optional(),
    validTo: z.string().optional(),
    attrs: attributeEdit.optional(),
  }),

  z.strictObject({
    op: z.literal('update_attrs'),
    targetKind: endpointKind,
    targetId: z.uuid(),
    attrs: attributeEdit,
  }),

  z.strictObject({
    op: z.literal('update_entity'),
    targetId: z.uuid(),
    label: z.string().trim().optional(),
    type: z.string().trim().optional(),
  }),

  z.strictObject({ op: z.literal('delete_entity'), targetId: z.uuid() }),
  z.strictObject({ op: z.literal('delete_relation'), targetId: z.uuid() }),
]);

export type WriteRequest = z.infer<typeof writeRequest>;
