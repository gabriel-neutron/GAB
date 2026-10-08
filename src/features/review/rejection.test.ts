import { expect, it } from 'vitest';

import { REJECTION_REASONS, rejectionGap } from './rejection';

it('offers the seven reasons in the words of the operator', () => {
  expect(REJECTION_REASONS.map((reason) => reason.words)).toStrictEqual([
    'Wrong value',
    'Not in the source',
    'Wrong type',
    'Duplicate',
    'Out of scope',
    'End rejected',
    'Other',
  ]);
});

it.each([
  ['', '', 'Choose a reason.'],
  ['other', '  ', 'Write the reason in the note.'],
  ['duplicate', 'x'.repeat(501), 'The note is 500 characters at most.'],
] as const)('holds back a rejection with the reason "%s"', (reason, note, gap) => {
  expect(rejectionGap(reason, note)).toBe(gap);
});

it.each([
  ['duplicate', ''],
  ['other', 'The page names a ferry.'],
  ['wrong_value', 'x'.repeat(500)],
] as const)('lets a rejection with the reason "%s" go', (reason, note) => {
  expect(rejectionGap(reason, note)).toBeNull();
});
