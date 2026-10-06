import { expect, test } from 'vitest';

import { chunkPages } from './chunk.ts';

test('a page longer than the cap gives two chunks on that page, with offsets in the page', () => {
  const chunks = chunkPages([{ page: 1, text: 'abcdefghij' }], 6);
  expect(chunks.map(({ page, start, text }) => ({ page, start, text }))).toStrictEqual([
    { page: 1, start: 0, text: 'abcdef' },
    { page: 1, start: 6, text: 'ghij' },
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
  const chunks = chunkPages([{ page: 1, text: '\u{1F6A2}ab\u{1F6A2}' }], 2);
  expect(chunks.map(({ start, text }) => ({ start, text }))).toStrictEqual([
    { start: 0, text: '\u{1F6A2}a' },
    { start: 2, text: 'b\u{1F6A2}' },
  ]);
});

test('an empty page gives no chunk', () => {
  expect(chunkPages([{ page: 1, text: '' }], 4)).toStrictEqual([]);
});

test('each chunk has a digest of its page, its start and its text', () => {
  const [first, second] = chunkPages(
    [
      { page: 1, text: 'same' },
      { page: 2, text: 'same' },
    ],
    10,
  );
  expect(first?.hash).toMatch(/^[0-9a-f]{64}$/u);
  expect(first?.hash).not.toBe(second?.hash);
});

test('a cap that is not a whole number above zero throws', () => {
  expect(() => chunkPages([{ page: 1, text: 'a' }], 0)).toThrow(/cap/u);
});
