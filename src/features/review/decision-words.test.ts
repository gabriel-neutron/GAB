import { expect, it } from 'vitest';

import { relationWording } from '@/shared/relation-words';

import { decisionWords } from './decision-words';
import { unitPageOf } from './unit-page';
import { SAMPLE_UNITS, UNIT_ANSWER } from './unit-sample';

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
  const found = unitPageOf(UNIT_ANSWER)?.units.find((held) => held.id === id);
  if (found === undefined) throw new Error(`the sample holds no unit ${id}`);
  return found;
};

it('says what Promote writes and what Reject rejects for an entity with its relations', () => {
  expect(decisionWords(unit(SAMPLE_UNITS.army), WORDS, null)).toStrictEqual({
    promote: {
      kind: 'writes',
      said:
        'Writes 5th Combined Arms Army (Military unit) and 1 relation. Source: GAB v1 ORBAT: ' +
        'military units and organisations of the v1 GeoPackage. You cannot undo this.',
    },
    reject: 'Rejects 5th Combined Arms Army and its 1 relation.',
  });
});

it('counts no relation of an entity that has none', () => {
  expect(decisionWords(unit(SAMPLE_UNITS.disputed), WORDS, null)).toStrictEqual({
    promote: {
      kind: 'writes',
      said:
        'Writes North American countries (State body) and 0 relations. Source: Financial ' +
        'sanctions and the trade of Russia. You cannot undo this.',
    },
    reject: 'Rejects North American countries and its 0 relations.',
  });
});

it('says why Promote cannot write a blocked unit, with each fault that blocks it', () => {
  expect(decisionWords(unit(SAMPLE_UNITS.link), WORDS, null)).toStrictEqual({
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
