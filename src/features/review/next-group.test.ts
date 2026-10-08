import { expect, it } from 'vitest';

import { nextGroup } from './next-group';

const RAIL = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

it('gives the group after the group of the action, in the order of the rail', () => {
  expect(nextGroup(RAIL, 'a')).toBe('b');
  expect(nextGroup(RAIL, 'b')).toBe('c');
});

it('gives the group before the last group, and no group when the rail holds no other', () => {
  expect(nextGroup(RAIL, 'c')).toBe('b');
  expect(nextGroup([{ id: 'a' }], 'a')).toBeNull();
});

it('gives the first group when the rail does not hold the group of the action', () => {
  expect(nextGroup(RAIL, 'gone')).toBe('a');
  expect(nextGroup([], 'gone')).toBeNull();
});
