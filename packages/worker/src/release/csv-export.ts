import { csvFile } from './csv-file.ts';
import { rowLicence } from './licence.ts';
import type { ReleaseClaim, ReleaseDocument, ReleaseRecord } from './release-record.ts';

/** One file of a release: its path in the release folder and its text. */
export interface ReleaseFile {
  readonly path: string;
  readonly text: string;
}

const ENTITY_HEADER = ['id', 'type', 'label', 'origin_label', 'licence', 'document_ids'];

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

const valueText = (value: unknown): string =>
  value === null || value === undefined
    ? ''
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);

/** The three CSV files of a release. Each file starts with the preamble, and each row carries
 * its label and its licence. The claims file has one row for each claim and each cited passage
 * of a public document, and one row for a public document with no cited passage. */
// A row that names what the release does not hold is a fault of the read, and a file with an
// empty field in its place would hide it.
const held = <T>(found: T | undefined, what: string): T => {
  if (found === undefined) throw new Error(`the release does not hold the ${what}`);
  return found;
};

export const csvExport = (record: ReleaseRecord, preamble: string): readonly ReleaseFile[] => {
  const documentOf = (id: string): ReleaseDocument =>
    held(record.documents.get(id), `document ${id}`);
  const licenceOf = (sources: readonly string[]) =>
    rowLicence(sources.map((id) => documentOf(id).licence));
  const entityLabel = new Map(record.entities.map((one) => [one.id, one.label]));
  const labelOf = (id: string): string => held(entityLabel.get(id), `element ${id}`);
  const relations = new Map(record.relations.map((one) => [one.id, one]));
  const relationOf = (id: string) => held(relations.get(id), `relation ${id}`);

  const entities = record.entities.map((one) => [
    one.id,
    one.type,
    one.label,
    one.origin_label,
    licenceOf(one.sources),
    one.sources.join(' '),
  ]);

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
    { path: 'entities.csv', text: csvFile(preamble, ENTITY_HEADER, entities) },
    { path: 'relations.csv', text: csvFile(preamble, RELATION_HEADER, relationRows) },
    { path: 'claims.csv', text: csvFile(preamble, CLAIM_HEADER, record.claims.flatMap(claimRows)) },
  ];
};
