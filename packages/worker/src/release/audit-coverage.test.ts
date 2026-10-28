import { expect, test } from 'vitest';

import { auditCoverage, auditText, type Steps } from './audit-coverage.ts';
import { csvFile } from './csv-file.ts';

const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000a2';
const C = '00000000-0000-4000-8000-0000000000a3';
const FIRM = '00000000-0000-4000-8000-0000000000c1';

const CLAIM_HEADER = [
  'claim_id',
  'claim_kind',
  'subject_kind',
  'subject_id',
  'attribute',
  'value',
  'document_id',
];
const REL_HEADER = ['id', 'type', 'from_id', 'to_id', 'valid_from', 'valid_to'];
const ENTITY_HEADER = ['id', 'type', 'label', 'document_ids'];

const claim = (subject: string, attribute: string, value: string): string[] => [
  `${subject}/${attribute}/${value}`,
  'attribute',
  'entity',
  subject,
  attribute,
  value,
  'd1',
];

const input = (references: Map<string, string>) => ({
  entities: csvFile('Preamble', ENTITY_HEADER, [
    [A, 'vessel', 'ALPHA', 'd1 d2'],
    [B, 'vessel', 'BETA', ''],
    [C, 'vessel', 'GAMMA', 'd1'],
    [FIRM, 'company', 'OWNER', ''],
  ]),
  relations: csvFile('Preamble', REL_HEADER, [
    ['r1', 'owns', FIRM, A, '2020-01-01', ''],
    ['r2', 'owns', FIRM, C, '', '2019-01-01'],
  ]),
  claims: csvFile('Preamble', CLAIM_HEADER, [
    claim(A, 'imo', '9123456'),
    claim(B, 'imo', '["9777777","9888888"]'),
    claim(A, 'flag', 'PA'),
    claim(A, 'flag', 'KM'),
    claim(C, 'imo', '9000000'),
  ]),
  manifest: '{"version":"1.0"}',
  references,
});

const steps = (reference: boolean): Steps => [
  {
    name: 'vessels',
    type: 'vessel',
    reference: reference ? { file: 'v.csv', document: 'doc-1' } : null,
    fields: [
      { name: 'owner', relation: 'owns' },
      { name: 'flag history', attribute: 'flag', min: 2 },
      { name: 'dated', dated: true },
      { name: 'sources', sources: 2 },
    ],
  },
];

test('joins by identifier only, and counts the depth of the matched entities', () => {
  // The number of ALPHA is text with a prefix and a space, and BETA holds its number in a list.
  const reference = 'key,value\nimo,9123456\nimo,9 777-777\nimo,9555555\n';
  const report = auditCoverage(input(new Map([['vessels', reference]])), steps(true));
  expect(report).toMatchObject({
    steps: [
      {
        coverage: { matched: 2, total: 3 },
        matched_entities: [A, B],
        unmatched_identifiers: ['imo:9555555'],
        depth: {
          owner: { held: 1, of: 2 },
          'flag history': { held: 1, of: 2 },
          dated: { held: 1, of: 2 },
          sources: { held: 1, of: 2 },
        },
      },
    ],
  });
});

test('refuses a reference key that does not join, as a name', () => {
  const reference = 'key,value\nname,ALPHA\n';
  expect(() => auditCoverage(input(new Map([['vessels', reference]])), steps(true))).toThrow(
    /name/u,
  );
});

test('a step with no reference is not measurable', () => {
  expect(auditCoverage(input(new Map()), steps(false))).toMatchObject({
    steps: [{ status: 'not measurable' }],
  });
});

test('two runs give the same bytes', () => {
  const run = (): string =>
    auditText(
      auditCoverage(
        input(new Map([['vessels', 'key,value\nimo,9777777\nimo,9123456\n']])),
        steps(true),
      ),
    );
  expect(run()).toBe(run());
});
