import { z } from 'zod';

import { cutsToken, findExcerpt } from './excerpt.ts';
import { rowsOf } from './fields.ts';
import { ToolRefusal, type Session } from './tool.ts';

// The cited passage of a removal or a join of an AI reviewer: one excerpt of one stored page.
// The tool finds the span in the newest text of the page, as `propose` does, and the database
// keeps it as the citation of the act.

const PAGE = `SELECT t.extractor, t.text FROM public.document_text t
  WHERE t.document_id = $1::text AND t.page = $2::int
    AND t.extractor = public.newest_text_extractor($1::text)`;

const pageRow = z.strictObject({ extractor: z.string(), text: z.string() });

/** The passage that an AI reviewer cites for its decision. */
export const passage = z
  .strictObject({
    document: z.string().min(1).describe('the id of a stored document, from find_document'),
    page: z.number().int().min(1).describe('the page of the stored text that holds the excerpt'),
    excerpt: z
      .string()
      .trim()
      .min(1)
      .max(2000)
      .describe('the words of the page that support your decision, copied as the page states them'),
  })
  .describe('the passage that shows why the record must change');

/** The citation of the passage, as the database takes it. */
export interface ReviewCitation {
  readonly document: string;
  readonly text_extractor: string;
  readonly page: number;
  readonly start: number;
  readonly end: number;
}

/** Finds the excerpt in its stored page, or refuses the call with the reason. */
export const citationOf = async (
  session: Session,
  given: z.output<typeof passage>,
): Promise<ReviewCitation> => {
  const [page] = await rowsOf(session, pageRow, PAGE, [given.document, given.page]);
  if (page === undefined)
    throw new ToolRefusal(
      `passage: document ${given.document} has no page ${String(given.page)} of stored text`,
    );
  const span = findExcerpt(page.text, given.excerpt);
  if (span === null)
    throw new ToolRefusal(
      `passage: page ${String(given.page)} of ${given.document} does not hold the excerpt ` +
        `${JSON.stringify(given.excerpt)}. Copy the words as the page states them.`,
    );
  if (cutsToken(page.text, span))
    throw new ToolRefusal(
      `passage: the excerpt ${JSON.stringify(given.excerpt)} starts or ends inside a word or a ` +
        'number. Copy whole words and whole numbers.',
    );
  return {
    document: given.document,
    text_extractor: page.extractor,
    page: given.page,
    start: span.start,
    end: span.end,
  };
};
