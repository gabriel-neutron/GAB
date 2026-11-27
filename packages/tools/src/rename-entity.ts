import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { holdsWords, origin } from './review-correction.ts';
import { why } from './review-decision.ts';
import { citationOf, passage } from './review-passage.ts';
import { defineTool } from './tool.ts';

const RENAME =
  'SELECT public.ai_rename_entity($1::uuid, $2::text, $3::text, $4::jsonb, $5::text) AS said';

const row = z.object({
  said: z.object({
    rename: z.uuid(),
    kept: z.uuid(),
    entity: z.uuid(),
    before: z.string(),
    after: z.string(),
  }),
});

export const renameEntity = defineTool({
  name: 'rename_entity',
  description:
    'Gives an accepted entity its current name, when an official list or a register gives it, ' +
    'and keeps the name before in former_names or in aliases: no name is lost. The entity keeps ' +
    'its id, its values, its relations and its documents. The excerpt must hold the new name. ' +
    'The record writes two acts, the change of the name and the old name in the list, each with ' +
    'the origin "decided by an AI reviewer", your reason and the cited passage. remove_act takes ' +
    'each one back: remove the act "kept" too when you undo a rename. The database refuses the ' +
    'name that the entity holds, and a name that another entity of the same type holds: join ' +
    'those two with join_entities. Read the entity first (read_entity). Never rename an entity ' +
    'that you proposed: a new reviewer agent decides it.',
  input: z.strictObject({
    entityId: z.uuid().describe('the id of the entity, from read_entity'),
    label: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .describe('the current name, as the cited passage writes it'),
    keepAs: z
      .enum(['former_names', 'aliases'])
      .describe(
        'former_names when the source says the entity had the old name before; aliases when ' +
          'the old name is another spelling or a name in another script',
      ),
    passage,
    why,
  }),
  output: z.strictObject({
    rename: z.uuid(),
    kept: z.uuid(),
    entity: z.uuid(),
    before: z.string(),
    after: z.string(),
    origin,
  }),
  run: async (session, input) => {
    holdsWords('label', input.passage.excerpt, input.label);
    const cited = await citationOf(session, input.passage);
    const [held] = await rowsOf(session, row, RENAME, [
      input.entityId,
      input.label,
      input.keepAs,
      JSON.stringify(cited),
      input.why,
    ]);
    if (held === undefined) throw new Error('the rename returned no row');
    return { ...held.said, origin: 'decided by an AI reviewer' as const };
  },
});
