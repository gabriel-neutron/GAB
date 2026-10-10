import { expect, test } from 'vitest';

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
