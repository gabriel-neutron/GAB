import { expect, test } from 'vitest';

import { similarName } from './gem-duplicates.ts';

test('a name with generic words matches the same name without them', () => {
  expect(
    similarName('Yuzhno-Kirinskoye Field', 'Yuzhno-Kirinskoye Oil and Gas Field (Russia)'),
  ).toBe(true);
  expect(similarName('Urengoy gas field', 'Urengoy')).toBe(true);
  expect(similarName('Bovanenkovo oil and gas condensate deposit', 'Bovanenkovo')).toBe(true);
});

test('a place and the place with a prefix are two names', () => {
  expect(similarName('Kirinskoye field', 'Yuzhno-Kirinskoye Field')).toBe(false);
  expect(similarName('Field', 'Deposit')).toBe(false);
});
