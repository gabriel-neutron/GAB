import { z } from 'zod';

import { attributeEdit } from './attribute-value.ts';
import { type AttributeVocabulary } from './vocabulary.ts';

/** The five acts the operator may sign. A merge is absent: no promotion path applies one. */
export const WRITE_OPS = [
  'create_entity',
  'create_relation',
  'update_attrs',
  'delete_entity',
  'delete_relation',
] as const;

/** The two decisions the operator takes on an act that already stands in the record. A write
 * makes a proposal and signs it; a decision writes no proposal and names one that waits. */
export const DECISION_OPS = ['promote_proposal', 'reject_proposal'] as const;

export type DecisionOp = (typeof DECISION_OPS)[number];

/** The body of one decision. The act is taken from the address, as it is for a write. */
export const decisionRequest = z.strictObject({ proposalId: z.uuid() });

// A relation carries an interval only when it states identity or control. The database holds
// the same five words in a check constraint, and an interval elsewhere refuses the promotion.
export const DATED_RELATIONS = ['owns', 'operates', 'flags', 'insures', 'appoints'] as const;

const endpointKind = z.enum(['entity', 'relation']);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const position = z.array(z.number()).min(2).max(3);

const geometry = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('Point'), coordinates: position }),
  z.strictObject({ type: z.literal('MultiPoint'), coordinates: z.array(position) }),
  z.strictObject({ type: z.literal('LineString'), coordinates: z.array(position) }),
  z.strictObject({ type: z.literal('MultiLineString'), coordinates: z.array(z.array(position)) }),
  z.strictObject({ type: z.literal('Polygon'), coordinates: z.array(z.array(position)) }),
  z.strictObject({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(z.array(z.array(position))),
  }),
]);

/** The body of one write, with the act taken from the address and never from the caller. */
export const writeRequest = (vocabulary: AttributeVocabulary) => {
  const attrs = attributeEdit(vocabulary);

  return z.discriminatedUnion('op', [
    z.strictObject({
      op: z.literal('create_entity'),
      type: z.string().trim().min(1),
      label: z.string().trim().min(1),
      geom: geometry.optional(),
      attrs: attrs.optional(),
    }),

    z
      .strictObject({
        op: z.literal('create_relation'),
        type: z.string().trim().min(1),
        srcKind: endpointKind.default('entity'),
        srcId: z.uuid(),
        dstKind: endpointKind.default('entity'),
        dstId: z.uuid(),
        validFrom: day.optional(),
        validTo: day.optional(),
        attrs: attrs.optional(),
      })
      .refine(
        (act) =>
          (act.validFrom === undefined && act.validTo === undefined) ||
          DATED_RELATIONS.some((word) => word === act.type),
        { message: `an interval belongs to one of ${DATED_RELATIONS.join(', ')}` },
      ),

    z.strictObject({
      op: z.literal('update_attrs'),
      targetKind: endpointKind,
      targetId: z.uuid(),
      attrs,
    }),

    z.strictObject({ op: z.literal('delete_entity'), targetId: z.uuid() }),
    z.strictObject({ op: z.literal('delete_relation'), targetId: z.uuid() }),
  ]);
};

export type WriteRequest = z.infer<ReturnType<typeof writeRequest>>;
