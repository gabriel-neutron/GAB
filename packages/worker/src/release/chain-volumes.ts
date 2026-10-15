import { PRODUCT_LINK_TYPES } from '@gab/proposal/relation-types';

import type { ReleaseFile } from './csv-export.ts';
import { csvFile } from './csv-file.ts';
import { rowLicence } from './licence.ts';
import type { ReleaseRecord } from './release-record.ts';
import type { VolumeRejection, VolumeTable } from './volume-table.ts';

const HEADER = [
  'relation_id',
  'upstream',
  'downstream',
  'product',
  'period',
  'value',
  'minimum',
  'maximum',
  'unit',
  'class',
  'document_id',
  'document_title',
  'document_address',
  'page',
  'note',
  'licence',
];

const note = (table: VolumeTable | null, joined: number, kept: number): string =>
  [
    'Volumes table.',
    'One row for each row of the volume table of the research that the release keeps. A volume is an aggregate of the research for a period, not a fact of the record, and it has no label of the record.',
    'class is observed (a published figure), estimated (a computed figure with its range in minimum and maximum) or capacity (the nominal capacity of a pipeline, not a flow). A capacity is never added to a flow.',
    'unit is the unit of the source. Do not compare or add two rows with different units.',
    'upstream and downstream give the entity identifier of each asset, or the name that the research gives to an asset that the record does not hold. relation_id is the physical link of the two assets and the product, or empty when the record has no such link.',
    'Each row cites one public document of the release, with its page.',
    table === null
      ? 'This release had no volume table, so the table has no row.'
      : `Rows: ${String(kept)}. On a physical link: ${String(joined)}.`,
  ].join('\n');

/** The volumes table of a release: each row of the volume table, joined to the physical link of
 * the record that has its two assets and its product. A row that names an absorbed entity joins
 * the survivor. A row whose document is not a public document of the release is rejected with
 * the rejections of the table. A row that joins no link stays in the file with no link. */
export const chainVolumes = (
  record: ReleaseRecord,
  table: VolumeTable | null,
  preamble: string,
): { readonly file: ReleaseFile; readonly rejected: readonly VolumeRejection[] } => {
  const survivors = new Map<string, string>();
  for (const merge of record.merges)
    if (merge.resolves_to === null) survivors.delete(merge.absorbed_id);
    else survivors.set(merge.absorbed_id, merge.resolves_to);
  const resolved = (asset: string): string => survivors.get(asset) ?? asset;

  const links = new Map<string, string>();
  for (const relation of record.relations) {
    const key = `${relation.type} ${relation.src_id} ${relation.dst_id}`;
    if (!links.has(key)) links.set(key, relation.id);
  }

  const rejected: VolumeRejection[] = [...(table?.rejected ?? [])];
  const rows: string[][] = [];
  let joined = 0;
  for (const row of table?.rows ?? []) {
    const document = record.documents.get(row.document);
    if (document === undefined) {
      rejected.push({
        line: row.line,
        why: `the document ${row.document} is not a public document of the record`,
      });
      continue;
    }
    const upstream = resolved(row.upstream);
    const downstream = resolved(row.downstream);
    // Gas has no relation type of a physical link yet, so a gas row joins no link.
    const type = PRODUCT_LINK_TYPES[row.product];
    const link = type === null ? undefined : links.get(`${type} ${upstream} ${downstream}`);
    if (link !== undefined) joined += 1;
    rows.push([
      link ?? '',
      upstream,
      downstream,
      row.product,
      row.period,
      String(row.value),
      row.minimum === null ? '' : String(row.minimum),
      row.maximum === null ? '' : String(row.maximum),
      row.unit,
      row.volumeClass,
      document.id,
      document.title,
      document.uri ?? '',
      row.page,
      row.note,
      rowLicence([document.licence]),
    ]);
  }
  rejected.sort((one, two) => one.line - two.line);

  const body = note(table, joined, rows.length);
  return {
    file: {
      path: 'volumes.csv',
      text: csvFile(preamble === '' ? body : `${preamble}\n\n${body}`, HEADER, rows),
    },
    rejected,
  };
};
