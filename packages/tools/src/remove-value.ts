import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { origin } from './review-correction.ts';
import { why } from './review-decision.ts';
import { citationOf, passage } from './review-passage.ts';
import { defineTool } from './tool.ts';

const REMOVE =
  'SELECT public.ai_remove_value($1::uuid, $2::text, $3::jsonb, $4::jsonb, $5::text) AS said';

const LISTS = ['aliases', 'former_names', 'flag_history', 'mmsi_history', 'call_sign'] as const;

const row = z.object({
  said: z.object({
    removal: z.uuid(),
    entity: z.uuid(),
    name: z.string(),
    left: z.array(z.union([z.string(), z.number(), z.boolean()])),
  }),
});

export const removeValue = defineTool({
  name: 'remove_value',
  description:
    'Removes one wrong value from a list of an accepted entity: an alias, a former name (also ' +
    'one that a join added), a flag, an MMSI or a call sign. A change of these lists through ' +
    'propose only adds values, so this is the one way to take a value out. Each copy of the ' +
    'value leaves the list, and the other values keep their order. The documents of the list ' +
    'stay. The record keeps the act with the origin "decided by an AI reviewer", your reason, ' +
    'the cited passage and the list before, so remove_act puts the value back. Use it only when ' +
    'a passage shows that the value is wrong. Read the entity first (read_entity). Never remove ' +
    'a value that you proposed: a new reviewer agent decides it.',
  input: z.strictObject({
    entityId: z.uuid().describe('the id of the entity, from read_entity'),
    key: z.enum(LISTS).describe('the list that holds the wrong value'),
    value: z
      .union([z.string().min(1), z.number()])
      .describe('the wrong value, as read_entity gives it'),
    passage,
    why,
  }),
  output: z.strictObject({
    removal: z.uuid(),
    entity: z.uuid(),
    name: z.string(),
    left: z.array(z.union([z.string(), z.number(), z.boolean()])),
    origin,
  }),
  run: async (session, input) => {
    const cited = await citationOf(session, input.passage);
    const [held] = await rowsOf(session, row, REMOVE, [
      input.entityId,
      input.key,
      JSON.stringify(input.value),
      JSON.stringify(cited),
      input.why,
    ]);
    if (held === undefined) throw new Error('the removal returned no row');
    return { ...held.said, origin: 'decided by an AI reviewer' as const };
  },
});
