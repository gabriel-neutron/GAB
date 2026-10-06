import { expect, test } from 'vitest';

import { chunkPages } from './chunk.ts';

test('a page longer than the cap gives two chunks on that page', () => {
  expect(chunkPages([{ page: 1, text: 'abcdefghij' }], 6)).toStrictEqual([
    { page: 1, text: 'abcdef' },
    { page: 1, text: 'ghij' },
  ]);
});

test('a chunk never crosses a page', () => {
  const chunks = chunkPages(
    [
      { page: 1, text: 'abc' },
      { page: 2, text: 'defg' },
    ],
    10,
  );
  expect(chunks.map(({ page, text }) => ({ page, text }))).toStrictEqual([
    { page: 1, text: 'abc' },
    { page: 2, text: 'defg' },
  ]);
});

test('a surrogate pair is one code point, and the cap counts code points', () => {
  expect(chunkPages([{ page: 1, text: '\u{1F6A2}ab\u{1F6A2}' }], 2)).toStrictEqual([
    { page: 1, text: '\u{1F6A2}a' },
    { page: 1, text: 'b\u{1F6A2}' },
  ]);
});

test('an empty page gives no chunk', () => {
  expect(chunkPages([{ page: 1, text: '' }], 4)).toStrictEqual([]);
});

test('a cap that is not a whole number above zero throws', () => {
  expect(() => chunkPages([{ page: 1, text: 'a' }], 0)).toThrow(/cap/u);
});
