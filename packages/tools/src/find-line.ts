// A stored file can hold millions of lines, and document_text gives 40,000 characters a call. This
// tool goes straight to the lines that hold a key, so a fact can cite one line of a large file.

import { z } from 'zod';

import { documentId, rowsOf } from './fields.ts';
import { defineTool, ToolRefusal } from './tool.ts';

// Origin of the numbers: decided, not calibrated. A key of a table is in few lines, and a longer
// list is a second call. A one-line JSON file is one long line, so the answer gives a part of it.
const DEFAULT_LINES = 20;
const MAX_LINES = 100;
const LINE_CHARACTERS = 2000;

export interface FoundLine {
  readonly line: number;
  readonly text: string;
  readonly cut: boolean;
}

// An index that does not split a character that JavaScript holds in two units, so the part is a
// quote of the page.
const wholeAt = (page: string, at: number): number => {
  const unit = page.charCodeAt(at);
  return unit >= 0xdc00 && unit <= 0xdfff ? at + 1 : at;
};

/** The lines of a page that hold the text, from the line `fromLine`, and at most `limit` of them.
 * A line counts from 1, and a table repeats its header as line 1 of each page. */
export const linesHolding = (
  page: string,
  text: string,
  fromLine: number,
  limit: number,
): { lines: FoundLine[]; nextLine: number | null } => {
  const lines: FoundLine[] = [];
  let number = 1;
  let counted = 0;
  let found = page.indexOf(text);
  while (found !== -1) {
    for (let at = page.indexOf('\n', counted); at !== -1 && at < found;) {
      number += 1;
      counted = at + 1;
      at = page.indexOf('\n', counted);
    }
    const start = page.lastIndexOf('\n', found) + 1;
    const stop = page.indexOf('\n', found);
    const end = stop === -1 ? page.length : stop;
    if (number >= fromLine) {
      if (lines.length === limit) return { lines, nextLine: number };
      // A long line gives the part around the text, so a key late in the line still shows.
      const long = end - start > LINE_CHARACTERS;
      const from = wholeAt(page, long ? Math.max(start, found - LINE_CHARACTERS / 2) : start);
      const to = wholeAt(page, Math.min(end, from + LINE_CHARACTERS));
      lines.push({ line: number, text: page.slice(from, to).replace(/\r$/u, ''), cut: long });
    }
    if (stop === -1) break;
    found = page.indexOf(text, end);
  }
  return { lines, nextLine: null };
};

// One page at a time: a page is up to 16 MiB, and a file has many.
const PAGE = `SELECT t.page::int AS page, t.text
  FROM public.document_text t
 WHERE t.document_id = $1::text
   AND t.extractor = coalesce($2::text, public.newest_text_extractor($1::text))
   AND t.page >= $3::int
   AND strpos(t.text, $4::text) > 0
 ORDER BY t.page
 LIMIT 1`;

const pageRow = z.strictObject({ page: z.number().int(), text: z.string() });

const nextShape = z
  .strictObject({ page: z.number().int().min(1), line: z.number().int().min(1) })
  .nullable();

export const findLine = defineTool({
  name: 'find_line',
  description:
    'Finds the lines of one stored document that hold a text, such as an identifier or a name, ' +
    'in the exact form that the file writes it. It gives the page and the line of each one. Use ' +
    'it for a file that is too large to read with document_text. To cite a line, give the page ' +
    'and the words of the line to propose as the excerpt, up to 600 characters. "cut" says that ' +
    'the line is longer than the answer gives, and a long line needs a shorter excerpt. When "next" is present, give it as fromPage and ' +
    'fromLine to read on. A table repeats its header as line 1 of each page, so a line number ' +
    'counts in the page and not in the source file. A workbook above 16 MiB keeps only the first ' +
    'rows of each sheet in its pages; give textSet to read a text set that a mapping made. It ' +
    'reads the record and changes nothing.',
  input: z.strictObject({
    document: documentId,
    text: z.string().min(3).max(600).describe('the words to find, in one line of the file'),
    textSet: z.string().min(1).optional().describe('the name of a text set; the newest with none'),
    fromPage: z.number().int().min(1).default(1),
    fromLine: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(MAX_LINES).default(DEFAULT_LINES),
  }),
  output: z.strictObject({
    document: z.string(),
    lines: z.array(
      z.strictObject({
        page: z.number().int(),
        line: z.number().int(),
        text: z.string(),
        cut: z.boolean(),
      }),
    ),
    next: nextShape,
  }),
  async run(session, input) {
    if (input.text.includes('\n'))
      throw new ToolRefusal('give the words of one line: the text holds a line end');
    const pageFrom = async (page: number) =>
      (
        await rowsOf(session, pageRow, PAGE, [
          input.document,
          input.textSet ?? null,
          page,
          input.text,
        ])
      )[0];
    const lines: { page: number; line: number; text: string; cut: boolean }[] = [];
    for (let held = await pageFrom(input.fromPage); held !== undefined;) {
      const { page } = held;
      const fromLine = page === input.fromPage ? input.fromLine : 1;
      if (lines.length === input.limit)
        return { document: input.document, lines, next: { page, line: 1 } };
      const found = linesHolding(held.text, input.text, fromLine, input.limit - lines.length);
      lines.push(...found.lines.map((one) => ({ page, ...one })));
      if (found.nextLine !== null)
        return { document: input.document, lines, next: { page, line: found.nextLine } };
      held = await pageFrom(page + 1);
    }
    return { document: input.document, lines, next: null };
  },
});
