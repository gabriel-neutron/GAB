import { expect, test } from 'vitest';

import { groupConfirmation } from './group-confirmation';
import type { GroupUnit, GroupUnits } from './groups';

// The read says whether the action can write a unit. A clean unit is writable by default here.
const unit = (id: string, extra: Partial<GroupUnit> = {}): GroupUnit => ({
  id,
  kind: 'entity',
  name: id,
  type: 'military_unit',
  state: 'clean',
  faults: [],
  entities: 1,
  relations: 1,
  parent: null,
  writable: (extra.state ?? 'clean') === 'clean',
  ...extra,
});

const group = (units: readonly GroupUnit[]): GroupUnits => ({
  id: 'g1',
  subject: '58th Combined Arms Army',
  units,
});

const ARMY = unit('58th Army', { relations: 0 });
const BRIGADE = unit('19th Brigade', { parent: { unit: '58th Army', name: '58th Army' } });
const BATTALION = unit('1st Battalion', { parent: { unit: '19th Brigade', name: '19th Brigade' } });
const DISPUTED = unit('Disputed regiment', {
  state: 'not_clean',
  faults: [
    { kind: 'dispute', level: 'not_clean' },
    { kind: 'duplicate', level: 'not_clean' },
  ],
  parent: { unit: '58th Army', name: '58th Army' },
});
const DUPLICATE = unit('Twin regiment', {
  state: 'not_clean',
  faults: [{ kind: 'duplicate', level: 'not_clean' }],
});
const LINK = unit('Brigade subordinate to the district', {
  kind: 'link',
  type: 'subordinate_to',
  state: 'blocked',
  faults: [{ kind: 'end_waits', level: 'blocks' }],
  entities: 0,
});

test('the sentence counts what the action writes and why each other unit stays', () => {
  const read = groupConfirmation(group([ARMY, BRIGADE, BATTALION, DISPUTED, DUPLICATE, LINK]));
  expect(read.said).toBe(
    'Writes 3 entities and 2 relations of group 58th Combined Arms Army. 3 stay in the queue: ' +
      '1 disputed, 1 with a fault, 1 waiting for another group. You cannot undo this.',
  );
});

test('one entity and one relation are named in the singular', () => {
  const read = groupConfirmation(
    group([unit('Lone brigade', { parent: { unit: null, name: 'Southern District' } })]),
  );
  expect(read.said).toBe(
    'Writes 1 entity and 1 relation of group 58th Combined Arms Army. 0 stay in the queue: ' +
      '0 disputed, 0 with a fault, 0 waiting for another group. You cannot undo this.',
  );
});

test('the tree puts each clean unit under its clean parent, and the action sends that order', () => {
  // The read gives the units by name, so a child can come before its parent.
  const read = groupConfirmation(group([BATTALION, BRIGADE, DISPUTED, ARMY]));
  expect(read.tree.map(({ id, depth, under }) => [id, depth, under])).toStrictEqual([
    ['58th Army', 0, null],
    ['19th Brigade', 1, null],
    ['1st Battalion', 2, null],
  ]);
  expect(read.unitIds).toStrictEqual(['58th Army', '19th Brigade', '1st Battalion']);
});

test('a clean unit below a unit that stays in the queue stays too, with each unit below it', () => {
  const orphan = unit('2nd Battalion', {
    parent: { unit: 'Disputed regiment', name: 'Disputed regiment' },
    writable: false,
  });
  const company = unit('1st Company', {
    parent: { unit: '2nd Battalion', name: '2nd Battalion' },
    writable: false,
  });
  const held = unit('3rd Battalion', { parent: { unit: null, name: 'Southern District' } });
  const read = groupConfirmation(group([DISPUTED, company, orphan, held]));
  expect(read.tree.map(({ id, depth, under }) => [id, depth, under])).toStrictEqual([
    ['3rd Battalion', 0, 'Southern District'],
  ]);
  expect(read.unitIds).toStrictEqual(['3rd Battalion']);
  expect(read.said).toBe(
    'Writes 1 entity and 1 relation of group 58th Combined Arms Army. 3 stay in the queue: ' +
      '1 disputed, 2 with a fault, 0 waiting for another group. You cannot undo this.',
  );
});

test('a clean unit that the read says the action cannot write stays in the queue', () => {
  const read = groupConfirmation(group([{ ...BRIGADE, writable: false }]));
  expect(read.unitIds).toStrictEqual([]);
});

test('a group with no clean unit writes nothing, and the sentence says so', () => {
  const read = groupConfirmation({ ...group([DISPUTED, LINK]), subject: null });
  expect(read.unitIds).toStrictEqual([]);
  expect(read.said).toBe(
    'No unit of group with no subject is clean, so the action writes nothing. 2 stay in the ' +
      'queue: 1 disputed, 0 with a fault, 1 waiting for another group.',
  );
});
