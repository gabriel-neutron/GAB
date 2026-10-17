import { expect, test } from 'vitest';
import { readCsv } from '@gab/tools/csv';

import { csvExport } from './csv-export.ts';
import type { ReleaseClaim, ReleaseRecord } from './release-record.ts';

const SHIP = '00000000-0000-4000-8000-000000000001';
const OWNER = '00000000-0000-4000-8000-000000000002';
const OWNS = '00000000-0000-4000-8000-000000000003';
const ACT = '00000000-0000-4000-8000-000000000004';
const LABEL = 'Validated manually by the operator, on 2026-10-08';

const claim = (over: Partial<ReleaseClaim>): ReleaseClaim => ({
  claim_id: `${SHIP}/flag`,
  subject_kind: 'entity',
  subject_id: SHIP,
  attribute: 'flag',
  value: 'Panama',
  origin_label: LABEL,
  sources: ['doc_a'],
  act_id: ACT,
  passages: [
    {
      document: 'doc_a',
      page: 2,
      excerpt: 'flag of Panama',
      modality: 'asserts',
      transcribed: false,
    },
  ],
  ...over,
});

const recordOf = (claims: readonly ReleaseClaim[]): ReleaseRecord => ({
  entities: [
    {
      id: SHIP,
      type: 'vessel',
      label: 'A ship',
      origin_label: LABEL,
      sources: ['doc_a'],
      geom: null,
    },
    {
      id: OWNER,
      type: 'company',
      label: 'An owner',
      origin_label: LABEL,
      sources: ['doc_a'],
      geom: null,
    },
  ],
  relations: [
    {
      id: OWNS,
      type: 'owns',
      src_id: OWNER,
      dst_id: SHIP,
      valid_from: null,
      valid_to: null,
      origin_label: LABEL,
      sources: ['doc_a'],
    },
  ],
  claims,
  merges: [],
  documents: new Map([
    [
      'doc_a',
      {
        id: 'doc_a',
        title: 'A page',
        uri: 'https://example.org/a',
        retrieved_at: '2026-10-01',
        licence: null,
        provider: null,
      },
    ],
  ]),
  nameCandidates: { proposed: 0, confirmed: 0, refused: 0 },
  disclaimer: '',
  natoPairs: null,
});

const claimsText = (claims: readonly ReleaseClaim[]): string =>
  csvExport(recordOf(claims), '').find((file) => file.path === 'claims.csv')?.text ?? '';

test('a claim row gives the modality of its passage and whether the AI read it from an image', () => {
  const [header, row] = claimsText([claim({})])
    .slice(1)
    .split('\r\n');
  expect(header?.split(',').slice(-4)).toStrictEqual([
    'page',
    'excerpt',
    'modality',
    'transcribed',
  ]);
  expect(row?.split(',').slice(-4)).toStrictEqual(['2', 'flag of Panama', 'asserts', 'false']);
});

test('an absent value writes an empty field, and not the word null', () => {
  const [, row] = claimsText([claim({ value: null })])
    .slice(1)
    .split('\r\n');
  expect(row).not.toContain('null');
});

test('a claim that names a relation that the release does not hold stops the export', () => {
  expect(() =>
    claimsText([
      claim({ claim_id: 'x', subject_kind: 'relation', subject_id: SHIP, attribute: null }),
    ]),
  ).toThrow(/relation/u);
});

test('a claim that names a document that the release does not hold stops the export', () => {
  expect(() => claimsText([claim({ sources: ['doc_unknown'] })])).toThrow(/doc_unknown/u);
});

test('a claim about an element that the release does not hold stops the export', () => {
  expect(() => claimsText([claim({ subject_id: '00000000-0000-4000-8000-0000000000ff' })])).toThrow(
    /element/u,
  );
});

test('an undone merge resolves to nothing, and its field is empty', () => {
  const record: ReleaseRecord = {
    ...recordOf([]),
    merges: [
      {
        act_id: ACT,
        action: 'merge',
        day: '2026-10-10',
        absorbed_id: OWNER,
        survivor_id: SHIP,
        resolves_to: null,
        origin_label: LABEL,
      },
    ],
  };
  const text = csvExport(record, '').find((file) => file.path === 'merges.csv')?.text ?? '';
  expect(text.slice(1).split('\r\n')).toStrictEqual([
    'act_id,action,day,absorbed_id,survivor_id,resolves_to,origin_label',
    `${ACT},merge,2026-10-10,${OWNER},${SHIP},,"${LABEL}"`,
    '',
  ]);
});

test('with the NATO pair off, the claims file has no column of a letter or a digit', () => {
  const [header] = claimsText([claim({})])
    .slice(1)
    .split('\r\n');
  expect(header).not.toMatch(/nato/iu);
});

test('with the NATO pair on, each claim row gives its letter and its digit, or empty fields', () => {
  const record: ReleaseRecord = {
    ...recordOf([claim({}), claim({ claim_id: `${SHIP}/imo`, attribute: 'imo', value: '1' })]),
    natoPairs: new Map([[`${SHIP}/flag`, { letter: 'B', digit: 1 }]]),
  };
  const text = csvExport(record, '').find((file) => file.path === 'claims.csv')?.text ?? '';
  const [header, paired, unpaired] = text.slice(1).split('\r\n');
  expect(header?.split(',').slice(-2)).toStrictEqual(['nato_letter', 'nato_digit']);
  expect(paired?.split(',').slice(-2)).toStrictEqual(['B', '1']);
  expect(paired).toContain(`${SHIP}/flag`);
  expect(unpaired?.split(',').slice(-2)).toStrictEqual(['', '']);
  // Only the claims file shows the pair.
  for (const file of csvExport(record, ''))
    if (file.path !== 'claims.csv') expect(file.text).not.toMatch(/nato/iu);
});

test('a relation row gives its start and its end under valid_from and valid_to', () => {
  const record = recordOf([]);
  const dated: ReleaseRecord = {
    ...record,
    relations: record.relations.map((one) => ({
      ...one,
      valid_from: '2019-05-02',
      valid_to: '2023-11-30',
    })),
  };
  const text = csvExport(dated, '').find((file) => file.path === 'relations.csv')?.text ?? '';
  const [header, row] = text
    .slice(1)
    .split('\r\n')
    .map((line) => line.split(','));
  const at = (name: string): string | undefined => row?.[header?.indexOf(name) ?? -1];
  expect(at('valid_from')).toBe('2019-05-02');
  expect(at('valid_to')).toBe('2023-11-30');
});

test('a day that a later act gave is on its claim only, and a day from creation stays on the row', () => {
  const record = recordOf([
    claim({
      claim_id: `${OWNS}/valid_to`,
      subject_kind: 'relation',
      subject_id: OWNS,
      attribute: 'valid_to',
      value: '2023-11-30',
      sources: ['doc_b'],
      passages: [],
    }),
  ]);
  const dated: ReleaseRecord = {
    ...record,
    documents: new Map([
      ...record.documents,
      [
        'doc_b',
        {
          id: 'doc_b',
          title: 'A date act',
          uri: null,
          retrieved_at: null,
          licence: null,
          provider: null,
        },
      ],
    ]),
    relations: record.relations.map((one) => ({
      ...one,
      valid_from: '2019-05-02',
      valid_to: '2023-11-30',
    })),
  };
  const text = csvExport(dated, '').find((file) => file.path === 'relations.csv')?.text ?? '';
  const [header, row] = text
    .slice(1)
    .split('\r\n')
    .map((line) => line.split(','));
  const at = (name: string): string | undefined => row?.[header?.indexOf(name) ?? -1];
  expect(at('valid_from')).toBe('2019-05-02');
  expect(at('valid_to')).toBe('');
  // The end is a claim of its own, and it cites only the document of its act.
  const claims = csvExport(dated, '').find((file) => file.path === 'claims.csv')?.text ?? '';
  const end = claims.split('\r\n').filter((line) => line.startsWith(`${OWNS}/valid_to`));
  expect(end).toHaveLength(1);
  expect(end[0]).toContain('doc_b');
  expect(end[0]).not.toContain('doc_a');
});

test('a start from a later act leaves the end from creation on the row, and a date act with no public document leaves no claim', () => {
  const record = recordOf([
    claim({
      claim_id: `${OWNS}/valid_from`,
      subject_kind: 'relation',
      subject_id: OWNS,
      attribute: 'valid_from',
      value: '2019-05-02',
      passages: [],
    }),
  ]);
  const dated: ReleaseRecord = {
    ...record,
    relations: record.relations.map((one) => ({
      ...one,
      valid_from: '2019-05-02',
      valid_to: '2023-11-30',
    })),
  };
  const text = csvExport(dated, '').find((file) => file.path === 'relations.csv')?.text ?? '';
  const [header, row] = text
    .slice(1)
    .split('\r\n')
    .map((line) => line.split(','));
  const at = (name: string): string | undefined => row?.[header?.indexOf(name) ?? -1];
  expect(at('valid_from')).toBe('');
  expect(at('valid_to')).toBe('2023-11-30');
  // The release drops a date claim with no public document, so the row keeps its day.
  const hidden = csvExport({ ...dated, claims: [] }, '').find(
    (file) => file.path === 'relations.csv',
  );
  expect(hidden?.text).toContain('2019-05-02');
});

test('a sectoral measure is a relation row of the type restricted_by, with its label', () => {
  const record = recordOf([]);
  const restricted: ReleaseRecord = {
    ...record,
    relations: record.relations.map((one) => ({ ...one, type: 'restricted_by' })),
  };
  const text = csvExport(restricted, '').find((file) => file.path === 'relations.csv')?.text ?? '';
  const [header, row] = readCsv(text.slice(1)).map((line) => line.fields);
  // The label and the share follow the other columns, so a reader by position reads the other
  // columns as before.
  expect(header?.slice(-2)).toStrictEqual(['type_label', 'share']);
  expect(row?.[header?.indexOf('type') ?? -1]).toBe('restricted_by');
  expect(row?.at(-2)).toBe('restricted by');
  expect(row?.at(-1)).toBe('');
});

test('a share that GEM estimated reads as an estimate in the relation row', () => {
  const value = (attribute: string, held: unknown): ReleaseClaim =>
    claim({
      claim_id: `${OWNS}/${attribute}`,
      subject_kind: 'relation',
      subject_id: OWNS,
      attribute,
      value: held,
    });
  const shareOf = (claims: readonly ReleaseClaim[]): string | undefined => {
    const text =
      csvExport(recordOf(claims), '').find((file) => file.path === 'relations.csv')?.text ?? '';
    const [header, row] = readCsv(text.slice(1)).map((line) => line.fields);
    return row?.[header?.indexOf('share') ?? -1];
  };
  expect(shareOf([value('share_pct', 40.4), value('share_imputed', true)])).toBe(
    'share 40.4%, estimated by GEM',
  );
  expect(shareOf([value('share_pct', 40.4), value('share_imputed', false)])).toBe('share 40.4%');
  expect(shareOf([])).toBe('');
});

test('a type change is a claim row of its relation, with its label and its passage', () => {
  const retype = claim({
    claim_id: `${OWNS}/type`,
    subject_kind: 'relation',
    subject_id: OWNS,
    attribute: 'type',
    value: 'restricted_by',
  });
  const [header, row] = readCsv(claimsText([retype]).slice(1)).map((line) => line.fields);
  const at = (name: string) => row?.[header?.indexOf(name) ?? -1];
  expect(at('claim_id')).toBe(`${OWNS}/type`);
  expect(at('attribute')).toBe('type');
  expect(at('value')).toBe('restricted_by');
  expect(at('origin_label')).toBe(LABEL);
  expect(at('excerpt')).toBe('flag of Panama');
});
