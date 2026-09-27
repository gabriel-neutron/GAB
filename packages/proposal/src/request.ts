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

// A relation carries an interval only when it states identity or control. The database holds
// the same five words in a check constraint, and an interval elsewhere refuses the promotion.
export const DATED_RELATIONS = ['owns', 'operates', 'flags', 'insures', 'appoints'] as const;

const endpointKind = z.enum(['entity', 'relation']);

const DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

const LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const leapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

// External constraint: the promotion casts each end to a date after the proposal commits. The
// cast refuses `2026-02-30` and the year 0000, so the door refuses them first.
const inCalendar = (text: string): boolean => {
  const [year, month, date] = [text.slice(0, 4), text.slice(5, 7), text.slice(8, 10)].map(Number);
  if (year === undefined || month === undefined || date === undefined || year < 1) return false;
  const last = month === 2 && leapYear(year) ? 29 : LAST_DAY[month - 1];
  return last !== undefined && date >= 1 && date <= last;
};

const day = z
  .string()
  .regex(DAY_SHAPE, { abort: true })
  .refine(inCalendar, { message: 'a day that the calendar holds' });

interface Ends {
  readonly validFrom?: string | undefined;
  readonly validTo?: string | undefined;
}

// External constraint: the same rule as rel_dates_order, at the door. The promotion runs after
// the proposal commits, so an act that the check refuses would wait in the queue.
const inOrder = (ends: Ends): boolean =>
  ends.validFrom === undefined || ends.validTo === undefined || ends.validFrom <= ends.validTo;

const BACKWARDS = 'an interval starts on or before the day it ends';

/** Departure: an issue on a day names its end, and the order names none. The browser reads the
 * two apart by that path alone. */
export const interval = z
  .object({ validFrom: day.optional(), validTo: day.optional() })
  .refine(inOrder, { message: BACKWARDS });

// External constraint: the column holds two ordinates in degrees of EPSG:4326 and refuses a
// third. A number past the globe is a position in another system, stored as degrees.
const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

type Position = z.infer<typeof position>;

const RING_OPEN = 'a ring ends on the position it starts on';

const closes = (ring: readonly Position[]): boolean => {
  const [first, last] = [ring[0], ring.at(-1)];
  return first?.[0] === last?.[0] && first?.[1] === last?.[1];
};

// External constraint: GeoJSON gives a line two positions and a ring four, and PostGIS reads a
// shorter one as invalid. An empty list stores an empty geometry, and the database refuses it.
const points = z.array(position).min(1);
const line = z.array(position).min(2);
const ring = z.array(position).min(4).refine(closes, { message: RING_OPEN });
const lines = z.array(line).min(1);
const surface = z.array(ring).min(1);
const surfaces = z.array(surface).min(1);

const geometry = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('Point'), coordinates: position }),
  z.strictObject({ type: z.literal('MultiPoint'), coordinates: points }),
  z.strictObject({ type: z.literal('LineString'), coordinates: line }),
  z.strictObject({ type: z.literal('MultiLineString'), coordinates: lines }),
  z.strictObject({ type: z.literal('Polygon'), coordinates: surface }),
  z.strictObject({ type: z.literal('MultiPolygon'), coordinates: surfaces }),
]);

// External constraint: a btree index on the type refuses a row of about 2,704 bytes, after the
// proposal commits. 200 characters of four bytes each stay far below it. relations_type_length
// holds the same number.
const RELATION_TYPE_LENGTH = 200;

const NAMES_ATTRS = 'an update names at least one attribute';

const NAMES_COLUMN = 'the act names a new name, a new type, or both';

/** The body of one write, with the act taken from the address and never from the caller. */
export const writeRequest = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('create_entity'),
    type: z.string().trim().min(1),
    label: z.string().trim().min(1),
    geom: geometry.optional(),
    attrs: attributeEdit.optional(),
  }),

  z
    .strictObject({
      op: z.literal('create_relation'),
      type: z.string().trim().min(1).max(RELATION_TYPE_LENGTH),
      srcKind: endpointKind.default('entity'),
      srcId: z.uuid(),
      dstKind: endpointKind.default('entity'),
      dstId: z.uuid(),
      validFrom: day.optional(),
      validTo: day.optional(),
      attrs: attributeEdit.optional(),
    })
    .refine(
      (act) =>
        (act.validFrom === undefined && act.validTo === undefined) ||
        DATED_RELATIONS.some((word) => word === act.type),
      { message: `an interval belongs to one of ${DATED_RELATIONS.join(', ')}` },
    )
    .refine(inOrder, { message: BACKWARDS }),

  // External constraint: the same rule as proposals_update_names_attrs, at the door, so the
  // caller reads a 422 and not a constraint violation.
  z
    .strictObject({
      op: z.literal('update_attrs'),
      targetKind: endpointKind,
      targetId: z.uuid(),
      attrs: attributeEdit,
    })
    .refine((act) => Object.keys(act.attrs).length > 0, {
      message: NAMES_ATTRS,
      path: ['attrs'],
    }),

  // External constraint: the same rule as proposals_update_entity_shape, at the door, so the
  // caller reads a 422.
  z
    .strictObject({
      op: z.literal('update_entity'),
      targetId: z.uuid(),
      label: z.string().trim().min(1).optional(),
      type: z.string().trim().min(1).optional(),
    })
    .refine((act) => act.label !== undefined || act.type !== undefined, {
      message: NAMES_COLUMN,
    }),

  z.strictObject({ op: z.literal('delete_entity'), targetId: z.uuid() }),
  z.strictObject({ op: z.literal('delete_relation'), targetId: z.uuid() }),
]);

export type WriteRequest = z.infer<typeof writeRequest>;
