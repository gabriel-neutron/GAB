import { expect, it } from 'vitest';

import { plainText, verdictsOf } from './check-answer.ts';

it('changes each control character to a space, and keeps no run of spaces', () => {
  expect(plainText('a\u0000b\n\nc\td  e')).toBe('a b c d e');
});

it('gives the reason of a checker as plain text', () => {
  expect(
    verdictsOf(['e1'], {
      verdicts: [{ ref: 'e1', verdict: 'not_supported', reason: 'The page\u0000 says\n2019.' }],
    }),
  ).toStrictEqual([['e1', { verdict: 'not_supported', reason: 'The page says 2019.' }]]);
});
