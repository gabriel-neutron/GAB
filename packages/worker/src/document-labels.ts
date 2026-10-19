import { readableTitle } from '@gab/tools/document-title';
import { documentType } from '@gab/tools/document-type';
import { refusedSource } from '@gab/tools/refused-source';
import { z } from 'zod';

import type { Queryable } from './queryable.ts';

// Departure: one command, one job. Documents stored before a document had a type, or a readable
// title, hold the type `other` and sometimes an address or a file path as their title. This module
// gives each one the title and the type that the tools give to a new document. A title changes
// only when it is weak, and a type changes only from `other`, so a label that was set stays. It
// deletes no document: a search page that is stored is listed, and the operator decides.

const DOCUMENTS = `SELECT d.id::text AS id, d.title, d.uri, d.doc_type, d.provider_id,
       (SELECT t.text FROM public.document_text t
         WHERE t.document_id = d.id::text
           AND t.extractor = public.newest_text_extractor(d.id::text)
         ORDER BY t.page LIMIT 1) AS first_page
  FROM public.documents d
 ORDER BY d.id`;

// One statement for each change, so a title and a type are each one transaction.
const SET_TITLE = 'SELECT public.correct_document_title($1, $2, $3) AS done';
const SET_TYPE = 'SELECT public.fill_document_type($1, $2) AS done';

const documentRow = z.object({
  id: z.string(),
  title: z.string(),
  uri: z.string().nullable(),
  doc_type: z.string(),
  provider_id: z.string().nullable(),
  first_page: z.string().nullable(),
});

export interface TitleChange {
  readonly document: string;
  readonly from: string;
  readonly to: string;
}

export interface TypeChange {
  readonly document: string;
  readonly type: string;
}

/** A stored document whose address is a page of results of a search engine. */
export interface SearchPage {
  readonly document: string;
  readonly uri: string;
  readonly reason: string;
}

export interface RelabelReport {
  readonly dryRun: boolean;
  readonly read: number;
  readonly titles: readonly TitleChange[];
  readonly types: readonly TypeChange[];
  readonly searchPages: readonly SearchPage[];
}

/** Gives the title and the type to each stored document that needs them, and lists the stored
 * search pages. A dry run writes nothing. */
export const relabelDocuments = async (db: Queryable, dryRun: boolean): Promise<RelabelReport> => {
  const rows = z.array(documentRow).parse((await db.query(DOCUMENTS)).rows);
  const titles: TitleChange[] = [];
  const types: TypeChange[] = [];
  const searchPages: SearchPage[] = [];

  for (const row of rows) {
    const title = readableTitle(
      row.title,
      row.first_page === null ? [] : [row.first_page],
      row.uri,
    );
    if (title !== row.title) titles.push({ document: row.id, from: row.title, to: title });

    const type = documentType({ uri: row.uri, title, provider: row.provider_id });
    if (row.doc_type === 'other' && type !== 'other') types.push({ document: row.id, type });

    const refused = row.uri === null ? null : refusedSource(row.uri);
    if (row.uri !== null && refused !== null)
      searchPages.push({ document: row.id, uri: row.uri, reason: refused });
  }

  if (!dryRun) {
    for (const one of titles) await db.query(SET_TITLE, [one.document, one.from, one.to]);
    for (const one of types) await db.query(SET_TYPE, [one.document, one.type]);
  }
  return { dryRun, read: rows.length, titles, types, searchPages };
};

/** The lines that the command prints. */
export const reportLines = (report: RelabelReport): string[] => {
  const will = report.dryRun ? 'would set' : 'set';
  const lines: string[] = [];
  for (const one of report.titles)
    lines.push(`${will} the title of document ${one.document} to "${one.to}"`);
  for (const one of report.types)
    lines.push(`${will} the type of document ${one.document} to ${one.type}`);
  for (const one of report.searchPages)
    lines.push(
      `document ${one.document} is a search page, and it stays until the operator decides: ` +
        `${one.uri} (${one.reason})`,
    );
  lines.push(
    `${report.dryRun ? 'Dry run: ' : ''}${String(report.read)} documents read, ` +
      `${String(report.titles.length)} titles and ${String(report.types.length)} types ` +
      `${report.dryRun ? 'to set' : 'set'}, ${String(report.searchPages.length)} search pages listed.`,
  );
  return lines;
};
