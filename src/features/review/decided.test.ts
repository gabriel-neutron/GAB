import { expect, it } from 'vitest';

import { decidedRows, type DecidedAct } from './decided';
import { DECIDED_SAMPLE } from './decided-sample';

const act = (extra: Partial<DecidedAct>): DecidedAct => ({
  id: 'aa000009-0000-4000-8000-000000000002',
  op: 'create_entity',
  proposer: 'v1_import',
  status: 'accepted',
  decidedAt: '2026-10-07T09:12:44Z',
  decidedBy: 'operator',
  decidedAs: 'unit',
  decisionOrigin: null,
  rejectReason: null,
  rejectNote: null,
  name: '5th Combined Arms Army',
  ...extra,
});

it('keeps the order of the read, the latest decision first, and says the hour in UTC', () => {
  const rows = decidedRows(DECIDED_SAMPLE);
  expect(rows.map((row) => row.when)).toStrictEqual([
    '2026-10-07 14:02 UTC',
    '2026-10-07 13:40 UTC',
    '2026-10-07 09:12 UTC',
  ]);
});

it('lists a rejection with the words of its reason and its note', () => {
  const [row] = decidedRows([
    act({ status: 'rejected', rejectReason: 'wrong_value', rejectNote: 'A ferry, not a tanker.' }),
  ]);
  expect(row).toMatchObject({
    verdict: 'rejected',
    verdictWords: 'Rejected',
    reason: 'Wrong value: A ferry, not a tanker.',
  });
});

it('says that an older rejection kept no reason, and gives a promotion no reason', () => {
  expect(decidedRows([act({ status: 'rejected' })])[0]?.reason).toBe('No reason was recorded');
  expect(decidedRows([act({})])[0]?.reason).toBe('');
});

it('says who decided each act, and names a group action', () => {
  expect(
    decidedRows([
      act({ decidedAs: 'group' }),
      act({ decidedAs: 'unit' }),
      act({ decidedAs: null }),
    ]).map((row) => row.decidedHow),
  ).toStrictEqual([
    'validated manually by the operator, group action',
    'validated manually by the operator',
    'validated manually by the operator',
  ]);
});

it('names the rule that decided an act, and never calls it the operator', () => {
  const rows = decidedRows([
    act({ decidedAs: 'rule', decisionOrigin: 'rule strong_sources v1 (fact digits: 1)' }),
    act({
      status: 'rejected',
      decidedAs: 'rule',
      decisionOrigin: 'rule impossible v1 (fact digits: no fact)',
    }),
  ]);
  expect(rows.map((row) => row.decidedHow)).toStrictEqual([
    'accepted by the rule strong sources, version 1',
    'rejected by the rule impossible, version 1',
  ]);
});

it('names what the act changed, the act and the proposer, and never a machine', () => {
  const [row] = decidedRows([
    act({ op: 'create_relation', proposer: 'extractor', name: 'CEPR is linked to EBRD' }),
  ]);
  expect(row).toMatchObject({
    actWords: 'New relation',
    subject: 'CEPR is linked to EBRD',
    author: 'extractor',
  });
  expect(decidedRows([act({ name: null })])[0]?.subject).toBe(
    'An element that the act does not name',
  );
});
