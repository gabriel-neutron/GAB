import { expect, it } from 'vitest';

import { relationWording } from '@/shared/relation-words';

import { unitChanges } from './unit-changes';
import { unitPageOf } from './unit-page';
import { ORPHAN_RELATION, SAMPLE_UNITS, UNIT_ANSWER } from './unit-sample';

const page = unitPageOf(UNIT_ANSWER, null);

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
  entityType: (key: string): string => (key === 'military_unit' ? 'Military unit' : key),
};

const unit = (id: string) => {
  const found = page?.units.find((held) => held.id === id);
  if (found === undefined) throw new Error(`the sample holds no unit ${id}`);
  return found;
};

it('says a rejection before with the words of its reason and its note', () => {
  const said = page?.units
    .flatMap((held) => held.faults)
    .filter((fault) => fault.kind === 'rejected_before')
    .map((fault) => fault.said);
  expect(said).toStrictEqual(['Rejected before on 2026-10-06: Wrong value (A ferry.)']);
});

it('reads the answer of the writer into one unit for each line', () => {
  expect(page?.units.map((held) => held.kind)).toStrictEqual([
    'entity',
    'entity',
    'link',
    'entity',
    'entity',
    'link',
    'relation',
    'entity',
    'entity',
  ]);
  expect(page?.total).toBe(1082);
});

it('puts the entity first, with each attribute as a key and its values', () => {
  const changes = unitChanges(unit(SAMPLE_UNITS.army), WORDS);
  expect(changes.entity?.name).toBe('5th Combined Arms Army');
  expect(changes.entity?.type).toBe('Military unit');
  expect(changes.entity?.attributes.slice(0, 3)).toStrictEqual([
    { key: 'position', values: ['43.790382, 131.955795'] },
    { key: 'echelon', values: ['Army'] },
    { key: 'affiliation', values: ['Hostile'] },
  ]);
});

it('words each relation from the entity of the unit, and says where the other end stands', () => {
  expect(unitChanges(unit(SAMPLE_UNITS.army), WORDS).relations).toStrictEqual([
    {
      id: '3f6a1c2e-0b9d-4e7f-a1c3-5d7e9f1a3b5c',
      from: null,
      word: 'subordinate to',
      other: 'Eastern Military District',
      state: 'record',
      rejected: null,
      disputed: false,
    },
  ]);
  expect(unitChanges(unit(SAMPLE_UNITS.brigade), WORDS).relations[0]).toMatchObject({
    from: null,
    word: 'subordinate to',
    other: '5th Combined Arms Army',
    state: 'pending',
  });
});

it('reads a relation of its own from its source end', () => {
  const changes = unitChanges(unit(SAMPLE_UNITS.link), WORDS);
  expect(changes.entity).toBeNull();
  expect(changes.relations).toStrictEqual([
    {
      id: SAMPLE_UNITS.link,
      from: '1061st Logistics Center',
      word: 'subordinate to',
      other: 'Southern Military District',
      state: 'pending',
      rejected: null,
      disputed: false,
    },
  ]);
});

it('words the far end of a relation that points at the entity of the unit', () => {
  const army = unit(SAMPLE_UNITS.army);
  const brigade = unit(SAMPLE_UNITS.brigade);
  const both = { ...army, acts: [...army.acts, ...brigade.acts.slice(1)] };
  expect(unitChanges(both, WORDS).relations[1]).toMatchObject({
    from: null,
    word: 'commands',
    other: '57th Separate Motor Rifle Brigade',
  });
});

it('names the other end that the operator rejected, with the day', () => {
  expect(unitChanges(unit(SAMPLE_UNITS.orphan), WORDS).relations).toStrictEqual([
    {
      id: ORPHAN_RELATION,
      from: null,
      word: 'subordinate to',
      other: '1061st Logistics Center',
      state: 'rejected',
      rejected: { name: '1061st Logistics Center', on: '2026-10-07' },
      disputed: false,
    },
  ]);
});

it('names the source end of a link that the operator rejected', () => {
  expect(unitChanges(unit(SAMPLE_UNITS.rejectedSource), WORDS).relations[0]).toMatchObject({
    from: '1061st Logistics Center',
    other: 'Eastern Military District',
    state: 'record',
    rejected: { name: '1061st Logistics Center', on: '2026-10-07' },
  });
});
