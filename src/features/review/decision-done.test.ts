import { expect, it } from 'vitest';

import { decisionDone } from './decision-done';

const UNIT = 'a3f1c8de-5b20-4a71-9c34-7e0d81f65b12';

const written = (name: string, entities: number, relations: number) => ({
  name,
  entities,
  relations,
  others: 0,
});

it('says what a promotion wrote: the entity and the count of its relations', () => {
  expect(
    decisionDone({ op: 'promote_unit', unitId: UNIT }, written('5th Combined Arms Army', 1, 1)),
  ).toBe('Promoted 5th Combined Arms Army and 1 relation.');
  expect(decisionDone({ op: 'promote_unit', unitId: UNIT }, written('11th Corps', 1, 3))).toBe(
    'Promoted 11th Corps and 3 relations.',
  );
});

it('names an entity with no relation alone', () => {
  expect(
    decisionDone({ op: 'promote_unit', unitId: UNIT }, written('North American countries', 1, 0)),
  ).toBe('Promoted North American countries.');
});

it('names a unit of one relation as the relation', () => {
  expect(
    decisionDone(
      { op: 'promote_unit', unitId: UNIT },
      written('1061st Logistics Center subordinate to Southern Military District', 0, 1),
    ),
  ).toBe(
    'Promoted the relation 1061st Logistics Center subordinate to Southern Military District.',
  );
});

it('says what a rejection rejected, and the words of its reason', () => {
  expect(
    decisionDone(
      { op: 'reject_unit', unitId: UNIT, reason: 'duplicate', note: 'twice in the file' },
      written('5th Combined Arms Army', 1, 1),
    ),
  ).toBe('Rejected 5th Combined Arms Army: Duplicate.');
  expect(
    decisionDone(
      { op: 'reject_relation', proposalId: UNIT, reason: 'end_rejected' },
      written('117th GRAU arsenal subordinate to 1061st Logistics Center', 0, 1),
    ),
  ).toBe(
    'Rejected the relation 117th GRAU arsenal subordinate to 1061st Logistics Center: End rejected.',
  );
});
