import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { MODALITIES } from './reading.ts';
import { defineTool, ToolRefusal } from './tool.ts';

// The door sets the reader number and the reader kind from the job, so neither one is an argument.
const PUT = `SELECT public.put_claim_reading($1::uuid, $2::uuid, $3::text, $4::int, $5::int,
  $6::int, $7::text, $8::boolean, $9::uuid, $10::text, $11::text, $12::text, $13::text)::text
  AS id`;

const made = z.strictObject({ id: z.uuid() });

const digest = z.string().regex(/^[0-9a-f]{64}$/u);

// External constraint: the door raises its refusals with this code, and any other code is a fault
// of the database that the caller must see.
const REFUSED_CODE = '22023';

const codeOf = (cause: unknown): unknown =>
  typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : undefined;

export const putClaimReading = defineTool({
  name: 'put_claim_reading',
  description:
    'Stores where one claim stands in a page of the document of the job: the page, the start and ' +
    'the end in code points of the stored page, and the modality. It stores no quote.',
  input: z.strictObject({
    job: z.uuid(),
    claim: z.uuid().optional(),
    textExtractor: z.string().trim().min(1).max(200),
    page: z.number().int().min(1),
    start: z.number().int().min(0),
    end: z.number().int().min(1),
    modality: z.enum(MODALITIES),
    adverse: z.literal(true).optional(),
    modelCallId: z.uuid(),
    inputForm: z.string().trim().min(1).max(100),
    readerFingerprint: z.string().trim().min(1).max(500),
    chunkHash: digest,
    idempotencyKey: digest,
  }),
  output: z.strictObject({ readingId: z.uuid() }),
  async run(session, input) {
    let found: z.output<typeof made>[];
    try {
      found = await rowsOf(session, made, PUT, [
        input.job,
        input.claim ?? null,
        input.textExtractor,
        input.page,
        input.start,
        input.end,
        input.modality,
        input.adverse ?? null,
        input.modelCallId,
        input.inputForm,
        input.readerFingerprint,
        input.chunkHash,
        input.idempotencyKey,
      ]);
    } catch (cause) {
      if (codeOf(cause) === REFUSED_CODE && cause instanceof Error)
        throw new ToolRefusal(cause.message);
      throw cause;
    }
    const [row] = found;
    if (row === undefined) throw new Error('the door stored a reading and returned no identifier');
    return { readingId: row.id };
  },
});
