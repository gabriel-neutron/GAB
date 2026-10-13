import { sheetCsv, textSetName, XLSX_MIME, type TableFilter } from '@gab/text/xlsx';
import { readCsv } from '@gab/tools/csv';
import { z } from 'zod';

import type { Queryable } from './queryable.ts';

// A text set is the table of one sheet of a stored workbook, with one column filter. It is a set
// of pages of the same document under a name that holds the sheet, the filter and the version of
// the reader. The bytes and the filter alone make it, so the same file gives the same rows each
// time, and a citation names the set that it cites (ADR 0012, decisions.md P5).

const DOCUMENT = `SELECT d.s3_key, d.mime FROM public.documents d
  WHERE d.id = $1::text AND d.s3_key IS NOT NULL`;

const HELD = `SELECT t.text FROM public.document_text t
  WHERE t.document_id = $1::text AND t.extractor = $2::text AND t.page = 1`;

const PUT = 'SELECT public.put_document_text($1, $2::jsonb, $3)';

const documentRows = z.array(z.object({ s3_key: z.string(), mime: z.string().nullable() }));
const heldRows = z.array(z.object({ text: z.string() }));

export interface TextSetDeps {
  readonly db: Queryable;
  /** The bytes of one object of the raw store. */
  readonly read: (key: string) => Promise<Uint8Array>;
}

export interface TextSetRequest {
  readonly document: string;
  readonly sheet: string;
  readonly filter?: TableFilter;
}

export interface TextSetResult {
  /** The name of the set: the extractor that a mapping and a citation name. */
  readonly name: string;
  /** `stored` when this call wrote the set, `known` when the same set was stored before. */
  readonly status: 'stored' | 'known';
  readonly rows: number;
}

/** Makes the text set of one sheet of a stored workbook. It writes nothing when the set exists
 * already with the same text, and it refuses a set that exists with other text. */
export const makeTextSet = async (
  deps: TextSetDeps,
  request: TextSetRequest,
): Promise<TextSetResult> => {
  const [stored] = documentRows.parse((await deps.db.query(DOCUMENT, [request.document])).rows);
  if (stored === undefined) throw new Error(`document ${request.document} holds no stored file`);
  if ((stored.mime ?? '').split(';')[0]?.trim().toLowerCase() !== XLSX_MIME)
    throw new Error(`document ${request.document} is no XLSX workbook`);

  const name = textSetName(request.sheet, request.filter);
  const text = sheetCsv(await deps.read(stored.s3_key), request.sheet, request.filter);
  const rows = readCsv(text).length - 1;

  const [held] = heldRows.parse((await deps.db.query(HELD, [request.document, name])).rows);
  if (held !== undefined) {
    if (held.text !== text)
      throw new Error(`the text set ${name} of ${request.document} holds other text already`);
    return { name, status: 'known', rows };
  }
  await deps.db.query(PUT, [request.document, JSON.stringify([text]), name]);
  return { name, status: 'stored', rows };
};
