import { expect, test } from 'vitest';

import { natoCoverageLines } from './nato-coverage.ts';
import type { ReleaseClaim, ReleaseRecord } from './release-record.ts';

const SHIP = '00000000-0000-4000-8000-000000000001';
const OWNER = '00000000-0000-4000-8000-000000000002';
const OWNS = '00000000-0000-4000-8000-000000000003';
const ACT = '00000000-0000-4000-8000-000000000004';
const LABEL = 'Validated manually by the operator, on 2026-10-08';

const claim = (
  claim_id: string,
  subject_kind: 'entity' | 'relation',
  subject_id: string,
  attribute: string | null,
): ReleaseClaim => ({
  claim_id,
  subject_kind,
  subject_id,
  attribute,
  value: attribute === null ? null : 'x',
  origin_label: LABEL,
  sources: ['doc_a'],
  act_id: ACT,
  passages: [],
});

const entity = (id: string, type: string) => ({
  id,
  type,
  label: type,
  origin_label: LABEL,
  sources: ['doc_a'],
  geom: null,
});

const RECORD: ReleaseRecord = {
  entities: [entity(SHIP, 'vessel'), entity(OWNER, 'company')],
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
  claims: [
    claim(`${SHIP}/flag`, 'entity', SHIP, 'flag'),
    claim(`${SHIP}/imo`, 'entity', SHIP, 'imo'),
    claim(`${OWNER}/country`, 'entity', OWNER, 'country'),
    claim(OWNS, 'relation', OWNS, null),
    claim(`${OWNS}/share`, 'relation', OWNS, 'share'),
  ],
  merges: [],
  documents: new Map(),
  nameCandidates: { proposed: 0, confirmed: 0, refused: 0 },
  disclaimer: '',
  natoPairs: null,
};

const PAIR = { letter: 'B', digit: 1 } as const;

test('the coverage counts the claims with a full pair, in all and by entity and relation type', () => {
  const lines = natoCoverageLines(
    RECORD,
    new Map([
      [`${SHIP}/imo`, PAIR],
      [OWNS, PAIR],
      [`${OWNS}/share`, PAIR],
    ]),
  );
  expect(lines).toStrictEqual([
    'group\twith a full pair\tpublic claims\tshare',
    'all\t3\t5\t60.0%',
    'entity company\t0\t1\t0.0%',
    'entity vessel\t1\t2\t50.0%',
    'relation owns\t2\t2\t100.0%',
  ]);
});

test('a release with no claim has a coverage of zero, and no group', () => {
  expect(natoCoverageLines({ ...RECORD, claims: [] }, new Map()).slice(1)).toStrictEqual([
    'all\t0\t0\t0.0%',
  ]);
});
