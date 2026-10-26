import { relationWords } from '@gab/proposal/relation-types';
import { shareWords } from '@gab/proposal/share';
import { findExcerpt } from '@gab/tools/excerpt';

import { csvFile } from './csv-file.ts';
import { ENTITY_COLUMNS, entityColumns } from './entity-columns.ts';
import { NOT_RATED } from './nato-pair.ts';
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
  'type_label',
  'share',
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
  'document_type',
  'value_in_excerpt',
];

/** The test of a claim row: the value of an attribute claim is in the excerpt of the row. A relation
 * claim has no value, and a row with no excerpt has nothing to test. */
const valueInExcerpt = (claim: ReleaseClaim, excerpt: string): string => {
  const value = valueText(claim.value);
  if (claim.attribute === null || value === '') return 'not_tested';
  if (excerpt === '') return 'no_excerpt';
  return findExcerpt(excerpt.toLowerCase(), value.toLowerCase()) === null ? 'no' : 'yes';
};

const NATO_HEADER = ['nato_letter', 'nato_digit'];

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
 * its label, and each row of the data its licence. The claims file has one row for each citation
 * of a claim (a claim has more than one row when it has more than one cited passage of a public
 * document), and one row for a public document with no cited passage. Each claim row also gives
 * the column value_in_excerpt and, when the release shows the NATO pair, its letter and its digit.
 * The log of the merges gives the entity that each absorbed identifier resolves to. */
export const csvExport = (record: ReleaseRecord, preamble: string): readonly ReleaseFile[] => {
  const lookup = releaseLookup(record);
  const { documentOf, licenceOf, labelOf, relationOf, daysOf } = lookup;

  const entities = record.entities.map((one) => {
    const columns = entityColumns(one, lookup);
    return ENTITY_COLUMNS.map((name) => columns[name]);
  });

  // The public values of each relation, so a share that GEM estimated reads as an estimate.
  const relationAttrs = new Map<string, Record<string, { v: unknown }>>();
  for (const claim of record.claims) {
    if (claim.subject_kind !== 'relation' || claim.attribute === null) continue;
    const held = relationAttrs.get(claim.subject_id) ?? {};
    held[claim.attribute] = { v: claim.value };
    relationAttrs.set(claim.subject_id, held);
  }

  const relationRows = record.relations.map((one) => [
    one.id,
    one.type,
    one.src_id,
    labelOf(one.src_id),
    one.dst_id,
    labelOf(one.dst_id),
    daysOf(one).from ?? '',
    daysOf(one).to ?? '',
    one.origin_label,
    licenceOf(one.sources),
    one.sources.join(' '),
    relationWords(one.type, false),
    shareWords(relationAttrs.get(one.id) ?? {}) ?? '',
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
        daysOf(relation).from ?? '',
        daysOf(relation).to ?? '',
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

  // S1: with the pair off, the file has no column of the pair, not even an empty one.
  const { natoPairs } = record;
  const natoFields = (claim: ReleaseClaim): string[] => {
    if (natoPairs === null) return [];
    const pair = natoPairs.get(claim.claim_id);
    return pair === undefined ? [NOT_RATED, NOT_RATED] : [pair.letter, String(pair.digit)];
  };

  const claimRows = (claim: ReleaseClaim): string[][] => {
    const head = [
      claim.claim_id,
      ...claimHead(claim),
      claim.origin_label,
      licenceOf(claim.sources),
    ];
    const nato = natoFields(claim);
    return claim.sources.flatMap((id) => {
      const document = documentOf(id);
      const source = [id, document.title, document.uri ?? '', document.retrieved_at ?? ''];
      const type = document.doc_type ?? 'other';
      const cited = claim.passages.filter((one) => one.document === id);
      return cited.length === 0
        ? [[...head, ...source, '', '', '', '', type, valueInExcerpt(claim, ''), ...nato]]
        : cited.map((one) => [
            ...head,
            ...source,
            String(one.page),
            one.excerpt,
            one.modality,
            String(one.transcribed),
            type,
            valueInExcerpt(claim, one.excerpt),
            ...nato,
          ]);
    });
  };
  const claimHeader = natoPairs === null ? CLAIM_HEADER : [...CLAIM_HEADER, ...NATO_HEADER];

  return [
    { path: 'entities.csv', text: csvFile(preamble, ENTITY_COLUMNS, entities) },
    { path: 'relations.csv', text: csvFile(preamble, RELATION_HEADER, relationRows) },
    { path: 'claims.csv', text: csvFile(preamble, claimHeader, record.claims.flatMap(claimRows)) },
    { path: 'merges.csv', text: csvFile(preamble, MERGE_HEADER, mergeRows) },
  ];
};
