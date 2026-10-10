import { csvFile } from './csv-file.ts';
import { ENTITY_COLUMNS, entityColumns } from './entity-columns.ts';
import { releaseLookup } from './release-lookup.ts';
import type { ReleaseClaim, ReleaseRecord } from './release-record.ts';

/** One file of a release: its path in the release folder and its text. */
export interface ReleaseFile {
  readonly path: string;
  readonly text: string;
}

const RELATION_HEADER = [
  'id',
  'type',
  'from_id',
  'from_label',
  'to_id',
  'to_label',
  'valid_from',
  'valid_to',
  'origin_label',
  'licence',
  'document_ids',
];

const CLAIM_HEADER = [
  'claim_id',
  'claim_kind',
  'subject_kind',
  'subject_id',
  'subject_label',
  'attribute',
  'value',
  'relation_type',
  'object_id',
  'object_label',
  'valid_from',
  'valid_to',
  'origin_label',
  'licence',
  'document_id',
  'document_title',
  'document_address',
  'document_read_on',
  'page',
  'excerpt',
  'modality',
  'transcribed',
];

const MERGE_HEADER = [
  'act_id',
  'action',
  'day',
  'absorbed_id',
  'survivor_id',
  'resolves_to',
  'origin_label',
];

const valueText = (value: unknown): string =>
  value === null || value === undefined
    ? ''
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);

/** The four CSV files of a release. Each file starts with the preamble, and each row carries
 * its label, and each row of the data its licence. The claims file has one row for each claim and
 * each cited passage of a public document, and one row for a public document with no cited
 * passage. The log of the merges gives the entity that each absorbed identifier resolves to. */
export const csvExport = (record: ReleaseRecord, preamble: string): readonly ReleaseFile[] => {
  const lookup = releaseLookup(record);
  const { documentOf, licenceOf, labelOf, relationOf } = lookup;

  const entities = record.entities.map((one) => {
    const columns = entityColumns(one, lookup);
    return ENTITY_COLUMNS.map((name) => columns[name]);
  });

  const relationRows = record.relations.map((one) => [
    one.id,
    one.type,
    one.src_id,
    labelOf(one.src_id),
    one.dst_id,
    labelOf(one.dst_id),
    one.valid_from ?? '',
    one.valid_to ?? '',
    one.origin_label,
    licenceOf(one.sources),
    one.sources.join(' '),
  ]);

  // A relation claim reads from its first end to its second end. A value reads as a key and a
  // value of its element, and the name of a relation is its two ends and its type.
  const claimHead = (claim: ReleaseClaim): string[] => {
    if (claim.attribute === null) {
      const relation = relationOf(claim.subject_id);
      return [
        'relation',
        'entity',
        relation.src_id,
        labelOf(relation.src_id),
        '',
        '',
        relation.type,
        relation.dst_id,
        labelOf(relation.dst_id),
        relation.valid_from ?? '',
        relation.valid_to ?? '',
      ];
    }
    const relation = claim.subject_kind === 'relation' ? relationOf(claim.subject_id) : undefined;
    const subjectLabel =
      relation === undefined
        ? labelOf(claim.subject_id)
        : `${labelOf(relation.src_id)} ${relation.type} ${labelOf(relation.dst_id)}`;
    return [
      'attribute',
      claim.subject_kind,
      claim.subject_id,
      subjectLabel,
      claim.attribute,
      valueText(claim.value),
      '',
      '',
      '',
      '',
      '',
    ];
  };

  const mergeRows = record.merges.map((one) => [
    one.act_id,
    one.action,
    one.day,
    one.absorbed_id,
    one.survivor_id,
    one.resolves_to ?? '',
    one.origin_label,
  ]);

  const claimRows = (claim: ReleaseClaim): string[][] => {
    const head = [
      claim.claim_id,
      ...claimHead(claim),
      claim.origin_label,
      licenceOf(claim.sources),
    ];
    return claim.sources.flatMap((id) => {
      const document = documentOf(id);
      const source = [id, document.title, document.uri ?? '', document.retrieved_at ?? ''];
      const cited = claim.passages.filter((one) => one.document === id);
      return cited.length === 0
        ? [[...head, ...source, '', '', '', '']]
        : cited.map((one) => [
            ...head,
            ...source,
            String(one.page),
            one.excerpt,
            one.modality,
            String(one.transcribed),
          ]);
    });
  };

  return [
    { path: 'entities.csv', text: csvFile(preamble, ENTITY_COLUMNS, entities) },
    { path: 'relations.csv', text: csvFile(preamble, RELATION_HEADER, relationRows) },
    { path: 'claims.csv', text: csvFile(preamble, CLAIM_HEADER, record.claims.flatMap(claimRows)) },
    { path: 'merges.csv', text: csvFile(preamble, MERGE_HEADER, mergeRows) },
  ];
};
