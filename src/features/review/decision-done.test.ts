import { expect, it } from 'vitest';

import { relationWording } from '@/shared/relation-words';

import { decisionDone } from './decision-done';
import { unitPageOf } from './unit-page';
import { ORPHAN_RELATION, SAMPLE_UNITS, UNIT_ANSWER } from './unit-sample';

const WORDS = {
  relation: relationWording([
    {
      key: 'subordinate_to',
      label: 'subordinate to',
      inverseLabel: 'commands',
      takesInterval: true,
      retired: false,
    },
  ]),
  entityType: (key: string): string => ({ military_unit: 'Military unit' })[key] ?? key,
};

const unit = (id: string) => {
  const found = unitPageOf(UNIT_ANSWER, null)?.units.find((held) => held.id === id);
  if (found === undefined) throw new Error(`the sample holds no unit ${id}`);
  return found;
};

it('says what a promotion wrote: the entity and the count of its relations', () => {
  const army = unit(SAMPLE_UNITS.army);
  expect(decisionDone(army, WORDS, { op: 'promote_unit', unitId: army.id })).toBe(
    'Promoted 5th Combined Arms Army and 1 relation.',
  );
});

it('names an entity with no relation alone', () => {
  const disputed = unit(SAMPLE_UNITS.disputed);
  expect(decisionDone(disputed, WORDS, { op: 'promote_unit', unitId: disputed.id })).toBe(
    'Promoted North American countries.',
  );
});

it('says what a rejection rejected, and its reason', () => {
  const army = unit(SAMPLE_UNITS.army);
  expect(
    decisionDone(army, WORDS, {
      op: 'reject_unit',
      unitId: army.id,
      reason: 'duplicate',
      note: 'twice in the file',
    }),
  ).toBe('Rejected 5th Combined Arms Army: Duplicate.');
});

it('names the one relation that a rejection aimed at', () => {
  const orphan = unit(SAMPLE_UNITS.orphan);
  expect(
    decisionDone(orphan, WORDS, {
      op: 'reject_relation',
      proposalId: ORPHAN_RELATION,
      reason: 'end_rejected',
    }),
  ).toBe('Rejected the relation subordinate to → 1061st Logistics Center: End rejected.');
});

it('names a relation that is its whole unit by its two ends', () => {
  const link = unit(SAMPLE_UNITS.link);
  expect(decisionDone(link, WORDS, { op: 'promote_unit', unitId: link.id })).toBe(
    'Promoted the relation 1061st Logistics Center subordinate to → Southern Military District.',
  );
});
