import { SEEDED_RELATION_TYPES } from '@gab/proposal/relation-types';
import { expect, test } from 'vitest';

import { definitionsOf } from './extractor.ts';

test('each live relation type reaches the extractor with its definition', () => {
  const keys = SEEDED_RELATION_TYPES.map((one) => one.key);
  const given = definitionsOf(keys);
  expect(Object.keys(given)).toEqual(keys);
  expect(given['supplies_items_to']).toContain('Far end:');
});

test('a key that the seed does not hold gets no definition', () => {
  expect(definitionsOf(['made_up'])).toEqual({});
});
