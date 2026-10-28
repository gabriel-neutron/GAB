import { expect, test } from 'vitest';

import { relationDefinition, SEEDED_RELATION_TYPES } from './relation-types.ts';

test('each relation type has one definition of a full sentence', () => {
  const lacking = SEEDED_RELATION_TYPES.filter(
    (one) => one.definition.trim() === '' || !one.definition.endsWith('.'),
  ).map((one) => one.key);
  expect(lacking).toEqual([]);
  const unread = SEEDED_RELATION_TYPES.filter(
    (one) => relationDefinition(one.key) !== one.definition,
  ).map((one) => one.key);
  expect(unread).toEqual([]);
});

test('a type that the list does not hold has no definition', () => {
  expect(relationDefinition('made_up')).toBeNull();
});

test.each(['settles_through', 'acts_for', 'supplies_items_to', 'transfers_funds_to', 'pays_for'])(
  '%s takes dates and has a definition with its far end',
  (key) => {
    const one = SEEDED_RELATION_TYPES.find((row) => row.key === key);
    expect(one?.takesInterval).toBe(true);
    expect(one?.definition).toContain('Far end:');
  },
);
