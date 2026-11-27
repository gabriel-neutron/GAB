import { z } from 'zod';

import { documentId, rowsOf } from './fields.ts';
import { holdsWords, origin } from './review-correction.ts';
import { why } from './review-decision.ts';
import { citationOf, passage } from './review-passage.ts';
import { defineTool } from './tool.ts';

const RETITLE =
  'SELECT public.ai_retitle_document($1::text, $2::text, $3::jsonb, $4::text) AS said';

const row = z.object({
  said: z.object({ document: z.string(), before: z.string(), after: z.string() }),
});

export const retitleDocument = defineTool({
  name: 'retitle_document',
  description:
    'Corrects the title of a stored document, when the stored title is wrong, such as a line ' +
    'of the page in place of its title. The bytes, the hash, the address and the text stay. ' +
    'The excerpt must hold the new title: cite the page that writes it, often the document ' +
    'itself. The record keeps each change of a title with the title before, the origin ' +
    '"decided by an AI reviewer", your reason and the cited passage. A second correction is the ' +
    'undo. Read the document first (find_document, document_text).',
  input: z.strictObject({
    document: documentId.describe('the id of the document, from find_document'),
    title: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .describe('the correct title, as the cited passage writes it'),
    passage,
    why,
  }),
  output: z.strictObject({
    document: z.string(),
    before: z.string(),
    after: z.string(),
    origin,
  }),
  run: async (session, input) => {
    holdsWords('title', input.passage.excerpt, input.title);
    const cited = await citationOf(session, input.passage);
    const [held] = await rowsOf(session, row, RETITLE, [
      input.document,
      input.title,
      JSON.stringify(cited),
      input.why,
    ]);
    if (held === undefined) throw new Error('the change of the title returned no row');
    return { ...held.said, origin: 'decided by an AI reviewer' as const };
  },
});
