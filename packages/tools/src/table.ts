import { LAYER_READER } from '@gab/text/geojson';
import { TABLE_READER } from '@gab/text/xlsx';
import { z } from 'zod';

import { CsvFault, readCsv, readTsv, type CsvRecord } from './csv.ts';
import { rowsOf } from './fields.ts';
import { readJsonTable } from './json-table.ts';
import { ToolRefusal, type Session } from './tool.ts';

/** How the fields of a table page are cut: at a comma with RFC 4180 quotes, or at a tab. */
export type TableFormat = 'csv' | 'tsv' | 'json';

/** The format of a table of this media type, or undefined for a type that is no table. An
 * SDMX-CSV table (application/vnd.sdmx.data+csv) is a CSV with a header row. A JSON page is a
 * table when it holds a `data` list of objects, as an answer of UN Comtrade does. */
export const tableFormatOf = (mime: string | null): TableFormat | undefined => {
  const type = (mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (type === 'application/json' || type.endsWith('+json')) return 'json';
  if (type === 'text/tab-separated-values') return 'tsv';
  if (type === 'text/csv' || type.endsWith('+csv')) return 'csv';
  return undefined;
};

/** The records of a table page: its header, and each data row. It throws a refusal for a page
 * that is not a table that a mapping can read. */
export const tableOf = (
  text: string,
  format: TableFormat,
): { header: string[]; rows: CsvRecord[] } => {
  if (format === 'json') return readJsonTable(text);
  let records: CsvRecord[];
  try {
    records = format === 'tsv' ? readTsv(text) : readCsv(text);
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

// The named text set, or the newest one when the caller names none. A CSV is one page.
const PAGES = `SELECT t.extractor, t.page::int AS page, t.text, d.mime
  FROM public.document_text t
  JOIN public.documents d ON d.id = t.document_id
 WHERE t.document_id = $1::text
   AND t.extractor = coalesce($2::text, public.newest_text_extractor($1::text))
 ORDER BY t.page`;

const pageRow = z.object({
  extractor: z.string(),
  page: z.number().int(),
  text: z.string(),
  mime: z.string().nullable(),
});

/** The one page of a stored table, the set of text it belongs to, and the format of its fields.
 * A table of a workbook is a named text set, and the reader takes that set and never the newest
 * one. The reader of a workbook or a layer writes a CSV, so its text set and a type that is no
 * table read as CSV. */
export const readTablePage = async (
  session: Session,
  document: string,
  textSet: string | null = null,
): Promise<{ textSet: string; page: number; text: string; format: TableFormat }> => {
  const pages = await rowsOf(session, pageRow, PAGES, [document, textSet]);
  const [first] = pages;
  if (first === undefined) throw new ToolRefusal(`document ${document} holds no text`);
  if (pages.length > 1)
    throw new ToolRefusal(
      `document ${document} holds ${String(pages.length)} pages, and a table is one`,
    );
  return {
    textSet: first.extractor,
    page: first.page,
    text: first.text,
    format: [TABLE_READER, LAYER_READER].some((reader) => first.extractor.startsWith(`${reader}|`))
      ? 'csv'
      : (tableFormatOf(first.mime) ?? 'csv'),
  };
};
