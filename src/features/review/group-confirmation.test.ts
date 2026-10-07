import { expect, test } from 'vitest';

import { groupConfirmation } from './group-confirmation';
import type { GroupUnit, GroupUnits } from './groups';

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
  const read = groupConfirmation(group([BRIGADE]));
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

test('a clean unit whose parent is not written by the action names that parent', () => {
  const orphan = unit('2nd Battalion', {
    parent: { unit: 'Disputed regiment', name: 'Disputed regiment' },
  });
  const held = unit('3rd Battalion', { parent: { unit: null, name: 'Southern District' } });
  const read = groupConfirmation(group([DISPUTED, orphan, held]));
  expect(read.tree.map(({ id, depth, under }) => [id, depth, under])).toStrictEqual([
    ['2nd Battalion', 0, 'Disputed regiment'],
    ['3rd Battalion', 0, 'Southern District'],
  ]);
});

test('a group with no clean unit writes nothing, and the sentence says so', () => {
  const read = groupConfirmation({ ...group([DISPUTED, LINK]), subject: null });
  expect(read.unitIds).toStrictEqual([]);
  expect(read.said).toBe(
    'No unit of group with no subject is clean, so the action writes nothing. 2 stay in the ' +
      'queue: 1 disputed, 0 with a fault, 1 waiting for another group.',
  );
});
