import { z } from 'zod';

import { documentId, rowsOf } from './fields.ts';
import { defineTool, ToolRefusal } from './tool.ts';

// A model reads every page it receives, and a report holds eighty pages. Ten pages answer one
// question, and a longer read is a second call that names the next range.
export const MAX_PAGES = 10;

// Ten dense pages run past a window that a small model reads well. The cut falls on a page
// boundary, or inside a page when that page is longer than the room that is left. The answer
// gives the page and the character offset where the next slice starts, so a long page is read in
// slices.
export const MAX_CHARACTERS = 40_000;

// The cut moves back one unit when it would split a character that JavaScript holds in two units.
const cutAt = (text: string, end: number): number => {
  const unit = text.charCodeAt(end - 1);
  return end < text.length && unit >= 0xd800 && unit <= 0xdbff ? end - 1 : end;
};

/** The last page of a range. It throws a refusal for a range that is reversed or too long. */
export const checkedRange = (fromPage: number, given: number | undefined): number => {
  const toPage = given ?? fromPage + MAX_PAGES - 1;
  if (toPage < fromPage)
    throw new ToolRefusal(`the range ends at page ${toPage}, before it starts at ${fromPage}`);
  if (toPage - fromPage + 1 > MAX_PAGES)
    throw new ToolRefusal(
      `the range holds ${toPage - fromPage + 1} pages, and a call reads at most ${MAX_PAGES}`,
    );
  return toPage;
};

// The newest set of text when the caller names none.
const PAGES = `WITH chosen AS (
    SELECT coalesce($4::text, public.newest_text_extractor($1::text)) AS extractor)
  SELECT t.extractor, t.page::int AS page, t.text,
         (SELECT max(m.page) FROM public.document_text m
           WHERE m.document_id = $1::text AND m.extractor = c.extractor)::int AS last_page
    FROM chosen c
    JOIN public.document_text t
      ON t.document_id = $1::text AND t.extractor = c.extractor
     AND t.page BETWEEN $2::int AND $3::int
   ORDER BY t.page`;

const TITLE = 'SELECT title, uri FROM api.document WHERE id = $1::text';

const titleRow = z.strictObject({ title: z.string(), uri: z.string().nullable() });

const row = z.strictObject({
  extractor: z.string(),
  page: z.number().int(),
  text: z.string(),
  last_page: z.number().int(),
});

/** Where the next slice starts: a page and a character offset in that page. */
export const nextShape = z
  .strictObject({ page: z.number().int().min(1), fromCharacter: z.number().int().min(0) })
  .nullable();

const outputShape = z.strictObject({
  document: z.string(),
  title: z.string(),
  url: z.string().nullable(),
  extractor: z.string().nullable(),
  pages: z.array(z.strictObject({ page: z.number().int().min(1), text: z.string() })),
  lastPage: z.number().int().nullable(),
  truncated: z.boolean(),
  next: nextShape,
});

export const documentText = defineTool({
  name: 'document_text',
  description:
    `Reads the text of the pages of one stored document, with its title and its address for a ` +
    `citation. A call returns at most ${MAX_PAGES} ` +
    `pages and ${MAX_CHARACTERS} characters, and "truncated" says that the text went on. ` +
    'When the text is cut, "next" gives the page and the character offset where the next slice ' +
    'starts: give them as fromPage and fromCharacter to read on. "lastPage" is the last page of ' +
    'the set, so the next call can start after the end of this one.',
  input: z.strictObject({
    document: documentId,
    fromPage: z.number().int().min(1).default(1),
    /** The character offset in the first page where the text starts. */
    fromCharacter: z.number().int().min(0).default(0),
    toPage: z.number().int().min(1).optional(),
    extractor: z.string().trim().min(1).max(200).optional(),
  }),
  output: outputShape,
  async run(session, input) {
    const toPage = checkedRange(input.fromPage, input.toPage);
    const [named] = await rowsOf(session, titleRow, TITLE, [input.document]);
    if (named === undefined)
      throw new ToolRefusal(
        `the record holds no document ${input.document}; find_document finds a stored one`,
      );

    const found = await rowsOf(session, row, PAGES, [
      input.document,
      input.fromPage,
      toPage,
      input.extractor ?? null,
    ]);

    const first = found[0];
    if (input.fromCharacter > 0) {
      if (first?.page !== input.fromPage)
        throw new ToolRefusal(
          `the set holds no page ${input.fromPage}, so it has no character ${input.fromCharacter}`,
        );
      if (input.fromCharacter >= first.text.length)
        throw new ToolRefusal(
          `page ${input.fromPage} holds ${first.text.length} characters, and the offset ` +
            `${input.fromCharacter} is after its end`,
        );
    }

    let room = MAX_CHARACTERS;
    let next: z.output<typeof nextShape> = null;
    const pages: { page: number; text: string }[] = [];
    for (const held of found) {
      const start = held.page === input.fromPage ? input.fromCharacter : 0;
      if (room <= 0) {
        next = { page: held.page, fromCharacter: start };
        break;
      }
      const end = cutAt(held.text, Math.min(held.text.length, start + room));
      pages.push({ page: held.page, text: held.text.slice(start, end) });
      room -= end - start;
      if (end < held.text.length) {
        next = { page: held.page, fromCharacter: end };
        break;
      }
    }

    return {
      document: input.document,
      title: named.title,
      url: named.uri,
      extractor: first?.extractor ?? null,
      pages,
      lastPage: first?.last_page ?? null,
      truncated: next !== null,
      next,
    };
  },
});
