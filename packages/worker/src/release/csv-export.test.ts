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
  documents: new Map([
    [
      'doc_a',
      {
        id: 'doc_a',
        title: 'A page',
        uri: 'https://example.org/a',
        retrieved_at: '2026-10-01',
        licence: null,
      },
    ],
  ]),
  disclaimer: '',
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
