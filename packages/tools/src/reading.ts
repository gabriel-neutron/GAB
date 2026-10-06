import { z } from 'zod';

import { proposedAct } from './propose-change.ts';

/** How a page states a claim. A reader picks one word, and code decides what follows from it. */
export const MODALITIES = ['enacts', 'asserts', 'attributes', 'alleges', 'denies'] as const;

// Origin: decided, not calibrated. One chunk states few claims, and a longer list is a model that
// repeats itself. Both readers take the same bound, so their lists are comparable.
export const MAX_CLAIMS_PER_CHUNK = 50;

// The span is the only evidence. A quote, a score and a note are absent, so a model cannot state
// what the page says or how sure it is: code reads the span again from the stored text. The flag
// takes true alone, so a reader can set it and never clear it.
const readingBase = z.strictObject({
  page: z.number().int().min(1),
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  modality: z.enum(MODALITIES),
  adverse: z.literal(true).optional(),
});

interface Span {
  readonly start: number;
  readonly end: number;
}

const ordered = (span: Span): boolean => span.start < span.end;

const ORDER = { message: 'a span starts before it ends', path: ['end'] };

/** One claim of the first reader: the act it proposes, and where the page states it. */
export const claimEntry = readingBase.extend({ act: proposedAct }).refine(ordered, ORDER);

/** One claim of the second reader. It proposes nothing, so it gives no act. */
export const readerTwoEntry = readingBase.refine(ordered, ORDER);

/** The whole answer of the first reader for one chunk. */
export const chunkAnswer = z.strictObject({
  claims: z.array(claimEntry).max(MAX_CLAIMS_PER_CHUNK),
});

/** The whole answer of the second reader for one chunk. */
export const readerTwoAnswer = z.strictObject({
  claims: z.array(readerTwoEntry).max(MAX_CLAIMS_PER_CHUNK),
});

export type ClaimEntry = z.output<typeof claimEntry>;
