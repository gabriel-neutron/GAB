import { layerCsv, layerSetName, ZIP_MIME } from '@gab/text/geojson';
import { sheetCsv, textSetName, XLSX_MIME, type TableFilter } from '@gab/text/xlsx';
import type { ZipSource } from '@gab/text/zip';
import { readCsv } from '@gab/tools/csv';
import { z } from 'zod';

import { CSV_MIMES, csvSetName, headlessCsv, type Extraction } from './csv-set.ts';
import type { Queryable } from './queryable.ts';

// A text set is the table of one sheet of a stored workbook, of one GeoJSON layer of a stored
// zip archive, or of a stored CSV file with no header row, with one column filter. It is a set of
// pages of the same document under a name that holds the sheet or the layer, the filter and the version of the reader. The bytes and the
// filter alone make it, so the same file gives the same rows each time, and a citation names the
// set that it cites (ADR 0012, decisions.md P5). The file is read as a stream, so a large file
// costs the memory of the rows that the filter keeps.

const DOCUMENT = `SELECT d.s3_key, d.mime FROM public.documents d
  WHERE d.id = $1::text AND d.s3_key IS NOT NULL`;

const HELD = `SELECT t.text FROM public.document_text t
  WHERE t.document_id = $1::text AND t.extractor = $2::text AND t.page = 1`;

const PUT = 'SELECT public.put_document_text($1, $2::jsonb, $3)';

const documentRows = z.array(z.object({ s3_key: z.string(), mime: z.string().nullable() }));
const heldRows = z.array(z.object({ text: z.string() }));

/** A stored file opened for reading at an offset, and the call that releases it. */
export type OpenedFile = ZipSource & { readonly close?: () => Promise<void> };

export interface TextSetDeps {
  readonly db: Queryable;
  /** Opens one object of the raw store. */
  readonly open: (key: string) => Promise<OpenedFile>;
}

export type TextSetRequest =
  | ({
      readonly document: string;
      readonly filter?: TableFilter;
    } & ({ readonly sheet: string } | { readonly layer: string }))
  | {
      /** A CSV file with no header row: the names of its columns, by position. */
      readonly document: string;
      readonly columns: readonly string[];
      /** Keeps the rows whose cell of this column holds this whole tag. */
      readonly tag?: TableFilter;
      /** Keeps the rows whose cell of each column holds exactly this value. Each filter must hold. */
      readonly equals?: readonly TableFilter[];
      /** Adds columns, each cut from a named column by a pattern. A filter may name them. */
      readonly extract?: readonly Extraction[];
    };

export interface TextSetResult {
  /** The name of the set: the extractor that a mapping and a citation name. */
  readonly name: string;
  /** `stored` when this call wrote the set, `known` when the same set was stored before. */
  readonly status: 'stored' | 'known';
  readonly rows: number;
}

/** Makes the text set of one sheet or one layer of a stored file. It writes nothing when the set
 * exists already with the same text, and it refuses a set that exists with other text. */
export const makeTextSet = async (
  deps: TextSetDeps,
  request: TextSetRequest,
): Promise<TextSetResult> => {
  const [stored] = documentRows.parse((await deps.db.query(DOCUMENT, [request.document])).rows);
  if (stored === undefined) throw new Error(`document ${request.document} holds no stored file`);
  const mime = (stored.mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  const kind =
    'columns' in request ? 'CSV file' : 'sheet' in request ? 'XLSX workbook' : 'zip archive';
  const accepted =
    'columns' in request
      ? CSV_MIMES.includes(mime)
      : mime === ('sheet' in request ? XLSX_MIME : ZIP_MIME);
  if (!accepted) throw new Error(`document ${request.document} is no ${kind}`);

  const name =
    'columns' in request
      ? csvSetName(request.columns, request.tag, request.equals, request.extract)
      : 'sheet' in request
        ? textSetName(request.sheet, request.filter)
        : layerSetName(request.layer, request.filter);
  const file = await deps.open(stored.s3_key);
  let text: string;
  try {
    text =
      'columns' in request
        ? await headlessCsv(file, request.columns, request.tag, request.equals, request.extract)
        : 'sheet' in request
          ? await sheetCsv(file, request.sheet, request.filter)
          : await layerCsv(file, request.layer, request.filter);
  } finally {
    await file.close?.();
  }
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
