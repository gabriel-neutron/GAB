// The finder of an excerpt. The span counts code points of the stored page, so the passage that
// the span cuts from the page is the passage that the excerpt quoted.

import { expect, test } from 'vitest';

import { findExcerpt, MAX_TOLERANT_UNITS, pointSlice } from './excerpt.ts';

const cut = (page: string, excerpt: string): string | null => {
  const span = findExcerpt(page, excerpt);
  return span === null ? null : pointSlice(page, span.start, span.end);
};

test.each([
  ['exact text after an emoji', '🚢 The tanker Nayara left.', 'Nayara', 'Nayara'],
  ['other white space', 'The tanker\n  Nayara left.', 'tanker Nayara', 'tanker\n  Nayara'],
  ['a soft hyphen', 'The tanker Na­yara left.', 'Nayara', 'Na­yara'],
  ['a hyphen at a line end', 'owned by Ros-\nneft since', 'by Rosneft', 'by Ros-\nneft'],
  ['a compatibility form', 'the ﬁrst tanker', 'first tanker', 'ﬁrst tanker'],
  ['typographic quotes', 'he said “no” today', 'said "no"', 'said “no”'],
  ['a decomposed accent in the excerpt', '𝐀 Société Générale', 'Société', 'Société'],
])('the finder reads %s', (_, page, excerpt, passage) => {
  expect(cut(page, excerpt)).toBe(passage);
});

test.each([
  ['an absent word', 'The tanker Nayara left.', 'Lukoil'],
  ['a letter without its accent', 'A café in the port', 'A cafe'],
  ['an empty excerpt', 'The tanker Nayara left.', '   '],
])('the finder refuses %s', (_, page, excerpt) => {
  expect(findExcerpt(page, excerpt)).toBeNull();
});

test('the cut of a span gives the passage that an array of code points gives', () => {
  const page = '🚢 The tanker 🚢🚢 Nayara left 𝐀.';
  const span = findExcerpt(page, 'Nayara');
  expect(span).not.toBeNull();
  if (span === null) return;
  const array = Array.from(page);
  expect(pointSlice(page, span.start, span.end)).toBe(array.slice(span.start, span.end).join(''));
  expect(pointSlice(page, span.start - 4, span.end + 4)).toBe(
    array.slice(span.start - 4, span.end + 4).join(''),
  );
  expect(pointSlice(page, 0, 1000)).toBe(page);
  expect(pointSlice(page, 3, 3)).toBe('');
});

test('a page above the tolerant size finds a folded excerpt at its end and across a window edge', () => {
  const filler = 'a '.repeat(2_500_000);
  const end = `${filler}he said “no” today\nDate of  listing:\n12.03.2022`;
  expect(cut(end, 'said "no"')).toBe('said “no”');
  expect(cut(end, 'Date of listing: 12.03.2022')).toBe('Date of  listing:\n12.03.2022');
  const edge = `${'a '.repeat(MAX_TOLERANT_UNITS / 2 - 3)}Date of\nlisting${filler}`;
  expect(cut(edge, 'Date of listing')).toBe('Date of\nlisting');
  expect(findExcerpt(end, 'Lukoil')).toBeNull();
});

test('a page above the tolerant size keeps the accent rule at a window end and the code point origin', () => {
  const size = MAX_TOLERANT_UNITS + 4096;
  const mark = String.fromCharCode(0x301);
  // The quote ends the window one unit before the "e" of the mark: "cafe" is at the window end.
  const accent = `${'a '.repeat((size - 6) / 2)} "cafe${mark} ${'a '.repeat(10)}`;
  expect(findExcerpt(accent, '“cafe')).toBeNull();
  const astral = `${'😀'.repeat(MAX_TOLERANT_UNITS)}said “no”`;
  expect(findExcerpt(astral, 'said "no"')?.start).toBe(MAX_TOLERANT_UNITS);
});
