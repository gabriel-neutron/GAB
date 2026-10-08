import { z } from 'zod';

import { CsvFault, readCsv, type CsvRecord } from './csv.ts';
import { rowsOf } from './fields.ts';
import { ToolRefusal, type Session } from './tool.ts';

/** The records of a table page: its header, and each data row. It throws a refusal for a page
 * that is not a table that a mapping can read. */
export const tableOf = (text: string): { header: string[]; rows: CsvRecord[] } => {
  let records: CsvRecord[];
  try {
    records = readCsv(text);
  } catch (cause) {
    if (cause instanceof CsvFault) throw new ToolRefusal(`the page is not a CSV: ${cause.message}`);
    throw cause;
  }
  const [first, ...rows] = records;
  if (first === undefined) throw new ToolRefusal('the page holds no header');
  const header = first.fields.map((name) => name.trim());
  if (header.some((name) => name === ''))
    throw new ToolRefusal('the header holds a column with no name');
  if (new Set(header).size !== header.length)
    throw new ToolRefusal('the header names one column twice');
  return { header, rows };
};

// The newest set of text, as the read tool chooses it. A CSV is one page.
const PAGES = `SELECT t.extractor, t.page::int AS page, t.text
  FROM public.document_text t
 WHERE t.document_id = $1::text AND t.extractor = public.newest_text_extractor($1::text)
 ORDER BY t.page`;

const pageRow = z.object({ extractor: z.string(), page: z.number().int(), text: z.string() });

/** The one page of a stored table, and the set of text it belongs to. */
export const readTablePage = async (
  session: Session,
  document: string,
): Promise<{ textSet: string; page: number; text: string }> => {
  const pages = await rowsOf(session, pageRow, PAGES, [document]);
  const [first] = pages;
  if (first === undefined) throw new ToolRefusal(`document ${document} holds no text`);
  if (pages.length > 1)
    throw new ToolRefusal(
      `document ${document} holds ${String(pages.length)} pages, and a table is one`,
    );
  return { textSet: first.extractor, page: first.page, text: first.text };
};
