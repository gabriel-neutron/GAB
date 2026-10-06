import { z } from 'zod';

import type { PageText } from './chunk.ts';
import type { Queryable } from './queryable.ts';

// The newest set of text, as the read tool and the propose tool choose it, because an older set is
// a reading that a newer one replaced. The model reads the pages that the excerpts are found in.
const PAGES = `WITH chosen AS (
    SELECT t.extractor FROM public.document_text t
     WHERE t.document_id = $1::text
     ORDER BY t.created_at DESC, t.extractor DESC LIMIT 1)
  SELECT t.page::int AS page, t.text
    FROM chosen c
    JOIN public.document_text t ON t.document_id = $1::text AND t.extractor = c.extractor
   ORDER BY t.page`;

const pageRows = z.array(z.object({ page: z.number().int(), text: z.string() }));

/** The pages of the newest text set of a document, or null when the document holds no text. */
export const readNewestPages = async (
  db: Queryable,
  documentId: string,
): Promise<readonly PageText[] | null> => {
  const rows = pageRows.parse((await db.query(PAGES, [documentId])).rows);
  return rows.length === 0 ? null : rows;
};
