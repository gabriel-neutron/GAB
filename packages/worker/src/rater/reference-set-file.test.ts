import { readFileSync } from 'node:fs';

import { expect, test } from 'vitest';

import { referenceAnswer } from './reference-set.ts';

const file = JSON.parse(
  readFileSync(new URL('./reference-set.json', import.meta.url), 'utf8'),
) as unknown;

test('the written set passes the rules of the reference answer', () => {
  expect(referenceAnswer.safeParse(file).success).toBe(true);
});

test('the written set holds the letters that the operator approved', () => {
  const set = referenceAnswer.parse(file);
  const count = (letter: string): number =>
    set.authors.filter((one) => one.letter === letter).length;

  expect(['A', 'B', 'C', 'D', 'E', 'F'].map(count)).toStrictEqual([4, 14, 8, 4, 2, 1]);
  expect(set.authors).toHaveLength(33);
});
