import { z } from 'zod';

import type { PageText } from './chunk.ts';
import type { Queryable } from './queryable.ts';

// The newest set of text, as the read tool chooses it, because an older set is a reading that a
// newer one replaced. Both readers read through this one query, so both get the same pages and,
// through the chunker, the same chunks.
const PAGES = `WITH chosen AS (
    SELECT t.extractor FROM public.document_text t
     WHERE t.document_id = $1::text
     ORDER BY t.created_at DESC, t.extractor DESC LIMIT 1)
  SELECT t.extractor, t.page::int AS page, t.text
    FROM chosen c
    JOIN public.document_text t ON t.document_id = $1::text AND t.extractor = c.extractor
   ORDER BY t.page`;

const pageRows = z.array(
  z.object({ extractor: z.string(), page: z.number().int(), text: z.string() }),
);

/** The pages of the newest text set of one document. */
export interface NewestPages {
  /** The extractor of the set. A reading names it with its page. */
  readonly textSet: string;
  readonly pages: readonly PageText[];
}

/** Reads the newest text set of a document, or null when the document holds no text. */
export const readNewestPages = async (
  db: Queryable,
  documentId: string,
): Promise<NewestPages | null> => {
  const rows = pageRows.parse((await db.query(PAGES, [documentId])).rows);
  const textSet = rows[0]?.extractor;
  if (textSet === undefined) return null;
  return { textSet, pages: rows.map(({ page, text }) => ({ page, text })) };
};
