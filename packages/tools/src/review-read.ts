import { PROPOSERS } from '@gab/proposal/proposer';
import { z } from 'zod';

import { rowsOf } from './fields.ts';
import type { Session } from './tool.ts';

// Departure: three exports, one job. The doubts, the units that wait and one unit are three reads
// of one page of the review queue, with the same answer.

const READ = `SELECT public.review_units($1::text[], $2::int, $3::uuid, $4::text, $5::text,
  $6::text, $7::text, $8::uuid, $9::text) AS page`;

// Origin: decided, not calibrated. The database reads no more than 200 units in one page, and a
// page of 20 units with their passages fits the context of a session.
const MOST_UNITS = 200;
const SOME_UNITS = 20;

// Origin: decided. A name longer than any name of the record finds nothing.
const LONGEST_NAME = 200;

/** The input of a read of one list of the queue: the place in the list, the size of the page,
 * and the filters of the page. */
export const listInput = z.strictObject({
  after: z
    .array(z.string())
    .length(8)
    .optional()
    .describe('the value of "next" of the page before; leave it out for the first page'),
  size: z.number().int().min(1).max(MOST_UNITS).default(SOME_UNITS),
  group: z.uuid().optional().describe('the id of one group of the queue'),
  proposer: z.enum(PROPOSERS).optional().describe('who proposed the unit'),
  fault: z
    .string()
    .regex(/^[a-z_]{1,40}$/u)
    .optional()
    .describe('the kind of one fault, such as "dispute" or "duplicate"'),
  document: z
    .string()
    .trim()
    .min(1)
    .max(LONGEST_NAME)
    .optional()
    .describe('a part of the title of a cited document'),
  name: z
    .string()
    .trim()
    .min(1)
    .max(LONGEST_NAME)
    .optional()
    .describe('a part of the name of a unit'),
});

/** One unit of the queue as the review page reads it: its acts, the cited passages, its faults,
 * and the reasons of each dispute and of each rejection before. */
const unit = z.record(z.string(), z.unknown());

/** One page of a list of the queue. */
export const pageOutput = z.strictObject({
  counts: z.strictObject({
    decided: z.number().int(),
    doubt: z.number().int(),
    waiting: z.number().int(),
  }),
  matched: z.number().int(),
  before: z.number().int(),
  next: z.array(z.string()).nullable(),
  units: z.array(unit),
});

const pageRow = z.object({
  page: z.object({
    counts: pageOutput.shape.counts,
    matched: z.number().int(),
    before: z.number().int(),
    next: z.array(z.string()).nullable(),
    units: z.array(unit),
  }),
});

interface Asked {
  readonly after?: readonly string[] | undefined;
  readonly size: number;
  readonly lane: 'doubt' | 'waiting' | null;
  readonly unit?: string | undefined;
  readonly group?: string | undefined;
  readonly proposer?: string | undefined;
  readonly fault?: string | undefined;
  readonly document?: string | undefined;
  readonly name?: string | undefined;
}

/** Reads one page of the review queue, as the review page reads it. */
export const readQueuePage = async (
  session: Session,
  asked: Asked,
): Promise<z.output<typeof pageOutput>> => {
  const [row] = await rowsOf(session, pageRow, READ, [
    asked.after ?? null,
    asked.size,
    asked.group ?? null,
    asked.proposer ?? null,
    asked.fault ?? null,
    asked.document ?? null,
    asked.name ?? null,
    asked.unit ?? null,
    asked.lane,
  ]);
  if (row === undefined) throw new Error('the read of the queue returned no page');
  return row.page;
};
