import { z } from 'zod';

import { attributeEdit } from './attribute-value.ts';

/** The six acts the operator may sign. A merge is absent: no promotion path applies one. */
export const WRITE_OPS = [
  'create_entity',
  'create_relation',
  'update_attrs',
  'update_entity',
  'delete_entity',
  'delete_relation',
] as const;

/** The two decisions the operator takes on an act that already stands in the record. A write
 * makes a proposal and signs it; a decision writes no proposal and names one that waits. */
export const DECISION_OPS = ['promote_proposal', 'reject_proposal'] as const;

export type DecisionOp = (typeof DECISION_OPS)[number];

/** The body of one decision. The act is taken from the address, as it is for a write. */
export const decisionRequest = z.strictObject({ proposalId: z.uuid() });

/** The two verdicts on a linked batch, which the operator decides as one unit. */
export const BATCH_VERDICTS = ['promote', 'reject'] as const;

export type BatchVerdict = (typeof BATCH_VERDICTS)[number];

/** The body of one decision on a linked batch. */
export const batchDecisionRequest = z.strictObject({
  batchId: z.uuid(),
  verdict: z.enum(BATCH_VERDICTS),
});

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
