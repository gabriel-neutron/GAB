import { expect, test } from 'vitest';

import { valueWords } from './value-words';

test('a percentage takes a thin space, and another unit takes a space', () => {
  expect(valueWords(13.7, '%')).toBe('13.7 %');
  expect(valueWords(1234.5, 'USD bn')).toBe('1,234.5 USD bn');
  expect(valueWords(4, '')).toBe('4');
});
