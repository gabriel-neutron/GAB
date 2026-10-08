import { expect, it } from 'vitest';

import { relationWording } from '@/shared/relation-words';

import { decisionWords } from './decision-words';
import { REJECTION_REASONS } from './rejection';
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
  entityType: (key: string): string =>
    ({ military_unit: 'Military unit', state_body: 'State body' })[key] ?? key,
};

const unit = (id: string) => {
  const found = unitPageOf(UNIT_ANSWER, null)?.units.find((held) => held.id === id);
  if (found === undefined) throw new Error(`the sample holds no unit ${id}`);
  return found;
};

const WITHOUT_END = REJECTION_REASONS.filter((reason) => reason.key !== 'end_rejected');

it('says what Promote writes and what Reject rejects for an entity with its relations', () => {
  expect(decisionWords(unit(SAMPLE_UNITS.army), WORDS, null)).toStrictEqual({
    reasons: WITHOUT_END,
    promote: {
      kind: 'writes',
      said: 'Writes 5th Combined Arms Army (Military unit) and 1 relation. You cannot undo this.',
    },
    reject: 'Rejects 5th Combined Arms Army and its 1 relation.',
  });
});

it('names no relation of an entity that has none', () => {
  expect(decisionWords(unit(SAMPLE_UNITS.disputed), WORDS, null)).toStrictEqual({
    reasons: WITHOUT_END,
    promote: {
      kind: 'writes',
      said: 'Writes North American countries (State body). You cannot undo this.',
    },
    reject: 'Rejects North American countries.',
  });
});

it('says why Promote cannot write a blocked unit, with each fault that blocks it', () => {
  expect(decisionWords(unit(SAMPLE_UNITS.link), WORDS, null)).toStrictEqual({
    reasons: WITHOUT_END,
    promote: {
      kind: 'blocked',
      said:
        'Promote is not possible. Waits for Southern Military District (group Southern ' +
        'Military District).',
    },
    reject:
      'Rejects the relation 1061st Logistics Center subordinate to → Southern Military District.',
  });
});

it('rejects one relation alone, and Promote stays the promotion of the unit', () => {
  const words = decisionWords(
    unit(SAMPLE_UNITS.army),
    WORDS,
    '3f6a1c2e-0b9d-4e7f-a1c3-5d7e9f1a3b5c',
  );
  expect(words.reject).toBe(
    'Rejects the relation subordinate to → Eastern Military District. The rest of the unit ' +
      'stays in the queue.',
  );
});

it('offers the reason "end rejected" only where the other end was rejected', () => {
  const keys = (id: string, aimed: string | null = null) =>
    decisionWords(unit(id), WORDS, aimed).reasons.map((reason) => reason.key);
  expect(keys(SAMPLE_UNITS.rejectedSource)).toContain('end_rejected');
  expect(keys(SAMPLE_UNITS.orphan)).not.toContain('end_rejected');
  expect(keys(SAMPLE_UNITS.orphan, ORPHAN_RELATION)).toContain('end_rejected');
  expect(keys(SAMPLE_UNITS.army, '3f6a1c2e-0b9d-4e7f-a1c3-5d7e9f1a3b5c')).not.toContain(
    'end_rejected',
  );
});

it('says that Promote alone waits for a unit of the same group, with one full stop', () => {
  expect(decisionWords(unit(SAMPLE_UNITS.brigade), WORDS, null).promote).toStrictEqual({
    kind: 'blocked',
    said:
      'Promote is not possible. Waits for 5th Combined Arms Army in this group: promote it ' +
      'first.',
  });
});

it('ends a fault that has its own full stop with one full stop only', () => {
  const said = decisionWords(unit(SAMPLE_UNITS.blockedMix), WORDS, null).promote.said;
  expect(said).not.toContain('..');
});

it('says that a second entity will be written when the record holds one of the same name', () => {
  const twin = {
    ...unit(SAMPLE_UNITS.army),
    state: 'not_clean' as const,
    faults: [
      {
        kind: 'duplicate' as const,
        level: 'not_clean' as const,
        act: null,
        said: 'Same name and type under the same parent: 5th Combined Arms Army is in the record',
      },
    ],
  };
  expect(decisionWords(twin, WORDS, null).promote).toStrictEqual({
    kind: 'writes',
    said:
      'A second 5th Combined Arms Army will be written; 5th Combined Arms Army is already in ' +
      'the record. Writes 5th Combined Arms Army (Military unit) and 1 relation. You cannot ' +
      'undo this.',
  });
});

it('says nothing of a second entity when the twin waits in the queue', () => {
  const said = decisionWords(unit(SAMPLE_UNITS.twin), WORDS, null).promote.said;
  expect(said).not.toContain('A second');
});
