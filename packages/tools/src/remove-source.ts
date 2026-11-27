import { z } from 'zod';

import { documentId, rowsOf } from './fields.ts';
import { origin } from './review-correction.ts';
import { why } from './review-decision.ts';
import { citationOf, passage } from './review-passage.ts';
import { defineTool } from './tool.ts';

const REMOVE = 'SELECT public.ai_remove_source($1::uuid, $2::text, $3::jsonb, $4::text) AS said';

const row = z.object({
  said: z.object({
    removal: z.uuid(),
    relation: z.uuid(),
    name: z.string(),
    sources: z.array(z.string()),
  }),
});

export const removeSource = defineTool({
  name: 'remove_source',
  description:
    'Removes one wrong source from an accepted relation: a document that does not state the ' +
    'relation. The relation, its dates and its other sources stay. The record keeps the act with ' +
    'the origin "decided by an AI reviewer", your reason, the cited passage and the list before, ' +
    'so remove_act puts the source back. The database refuses the last source of a relation ' +
    '(remove the relation with remove_act), a document that the relation does not cite, and the ' +
    'one source of its start or its end (remove that act first). Read the relation and the ' +
    'document first (read_entity, document_text). Never remove a source that you proposed: a ' +
    'new reviewer agent decides it.',
  input: z.strictObject({
    relationId: z.uuid().describe('the id of the relation, from read_entity'),
    document: documentId.describe('the id of the wrong source, as read_entity gives it'),
    passage,
    why,
  }),
  output: z.strictObject({
    removal: z.uuid(),
    relation: z.uuid(),
    name: z.string(),
    sources: z.array(z.string()),
    origin,
  }),
  run: async (session, input) => {
    const cited = await citationOf(session, input.passage);
    const [held] = await rowsOf(session, row, REMOVE, [
      input.relationId,
      input.document,
      JSON.stringify(cited),
      input.why,
    ]);
    if (held === undefined) throw new Error('the removal returned no row');
    return { ...held.said, origin: 'decided by an AI reviewer' as const };
  },
});
