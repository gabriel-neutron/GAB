import { expect, test } from 'vitest';

import { nameKey } from './name-key.ts';

test('a name key has one space, lower case and no edge space', () => {
  expect(nameKey(' Known \t Field ')).toBe('known field');
});
