import { PRODUCT_LINK_TYPES } from '@gab/proposal/relation-types';
import { isAccepted } from '@gab/release/accepted';

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
    'period is the year and the month of the figure, YYYY-MM.',
    'upstream and downstream give the entity identifier of each asset, or the name that the research gives to an asset that the record does not hold. The research names an asset by its entity identifier or by the exact label of one entity of the record. relation_id is the physical link of the two assets and the product, or empty when the record has no such link. When an accepted link and a link in review have the same assets and product, relation_id is the accepted link.',
    'Each row cites one public document of the release, with its page.',
    table === null
      ? 'This release had no volume table, so the table has no row.'
      : `Rows: ${String(kept)}. On a physical link: ${String(joined)}.`,
  ].join('\n');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

// A label matches in any case and with any run of spaces.
const plain = (text: string): string => text.trim().replace(/\s+/gu, ' ').toLowerCase();

/** The volumes table of a release: each row of the volume table, joined to the physical link of
 * the record that has its two assets and its product. The table names an asset by its entity
 * identifier, or by the exact label of one entity of the record, in any case and spacing. A row
 * that names an absorbed entity joins the survivor. When an accepted link and a proposed link
 * have the same two assets and product, the row joins the accepted link. A row whose document is
 * not a public document of the release is rejected with the rejections of the table. A row that
 * joins no link stays in the file with no link, and a label that names more than one entity gives
 * the reason in `unjoined`. */
export const chainVolumes = (
  record: ReleaseRecord,
  table: VolumeTable | null,
  preamble: string,
): {
  readonly file: ReleaseFile;
  readonly rejected: readonly VolumeRejection[];
  readonly unjoined: readonly VolumeRejection[];
} => {
  // The database moves each earlier alias to the new survivor when a survivor is absorbed in its
  // turn, so `resolves_to` is already the last survivor, and one step is enough.
  const survivors = new Map<string, string>();
  for (const merge of record.merges)
    if (merge.resolves_to === null) survivors.delete(merge.absorbed_id);
    else survivors.set(merge.absorbed_id, merge.resolves_to);

  const byLabel = Map.groupBy(record.entities, (one) => plain(one.label));
  const unjoined: VolumeRejection[] = [];
  const resolved = (asset: string, line: number): string => {
    if (UUID.test(asset)) return survivors.get(asset) ?? asset;
    const named = byLabel.get(plain(asset)) ?? [];
    const [only] = named;
    if (named.length === 1 && only !== undefined) return only.id;
    if (named.length > 1)
      unjoined.push({
        line,
        why: `${String(named.length)} entities of the record have the label "${asset}", so the row joins no link. Give the entity identifier`,
      });
    return asset;
  };

  // An accepted link replaces a proposed one with the same key. Else the first link stays.
  const links = new Map<string, { readonly id: string; readonly accepted: boolean }>();
  for (const relation of record.relations) {
    const key = `${relation.type} ${relation.src_id} ${relation.dst_id}`;
    const accepted = isAccepted(relation.origin_label);
    const held = links.get(key);
    if (held === undefined || (accepted && !held.accepted))
      links.set(key, { id: relation.id, accepted });
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
    const upstream = resolved(row.upstream, row.line);
    const downstream = resolved(row.downstream, row.line);
    const type = PRODUCT_LINK_TYPES[row.product];
    const link = links.get(`${type} ${upstream} ${downstream}`)?.id;
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
    unjoined,
  };
};
