import type { ReleaseFile } from './csv-export.ts';
import { csvFile } from './csv-file.ts';
import { rowLicence } from './licence.ts';
import type { ReleaseRecord } from './release-record.ts';

const HEADER = [
  'observation_id',
  'measure',
  'period',
  'value',
  'unit',
  'reporter',
  'partner',
  'product',
  'subject_id',
  'method',
  'publisher',
  'document_id',
  'document_title',
  'document_address',
  'page',
  'span_start',
  'span_end',
  'licence',
];

const NOTE = [
  'Figures table.',
  'One row for each aggregated figure of the record that has an open licence. A figure is not an entity: the operator decided it through a promoted mapping or a promoted act.',
  'reporter and partner are codes of the area list, and an empty reporter is a figure of the world. unit is the unit of the source: do not add two rows with different units or methods.',
  'Each row cites its document, its page and the span of its cell or row in the stored text.',
].join('\n');

/** The figures file of a release: one row for each figure that the database gives. The database
 * applies the licence filter of the public read, so a figure with a restricted licence is not in
 * the record that this function reads. */
export const observationExport = (record: ReleaseRecord, preamble: string): ReleaseFile => {
  const rows = (record.observations ?? []).map((one) => {
    const document = record.documents.get(one.document_id);
    return [
      one.id,
      one.measure,
      one.period,
      one.value,
      one.unit,
      one.reporter ?? '',
      one.partner ?? '',
      one.product ?? '',
      one.subject_id ?? '',
      one.method,
      one.publisher,
      one.document_id,
      document?.title ?? '',
      document?.uri ?? '',
      String(one.page),
      String(one.span_start),
      String(one.span_end),
      rowLicence([one.licence]),
    ];
  });
  return {
    path: 'observations.csv',
    text: csvFile(preamble === '' ? NOTE : `${preamble}\n\n${NOTE}`, HEADER, rows),
  };
};
