// The finder of an excerpt. The span counts code points of the stored page, so the passage that
// the span cuts from the page is the passage that the excerpt quoted.

import { expect, test } from 'vitest';

import { findExcerpt } from './excerpt.ts';

const cut = (page: string, excerpt: string): string | null => {
  const span = findExcerpt(page, excerpt);
  return span === null ? null : Array.from(page).slice(span.start, span.end).join('');
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
