import { expect, test } from 'vitest';

import { similarName, similarStem } from './gem-duplicates.ts';

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

test('a name that only one side gives in generic words equals the bare name', () => {
  expect(similarName('Kirinskoye Oil and Gas Field (Russia)', 'Kirinskoye')).toBe(true);
});

test('a dossier name with no point pairs on the stem of the place', () => {
  const gem = (name: string) => similarStem(name, 'Bovanenkovo oil and gas condensate deposit');
  expect(gem('Bovanenkovskoye (Gazprom) Oil and Gas Asset (Russia)')).toBe(true);
  expect(similarStem('Urengoyskoye (Urengoyskoye) Asset', 'Urengoy gas field')).toBe(true);
  expect(similarStem('Kirinskoye Gas and Condensate Field (Russia)', 'Kirinskoye field')).toBe(
    true,
  );
});

test('a hyphenated place is not the place without its prefix, and a stem needs 6 letters', () => {
  expect(similarStem('Yuzhno-Kirinskoye Oil and Gas Field (Russia)', 'Kirinskoye field')).toBe(
    false,
  );
  expect(
    similarStem('Kirinskoye Gas and Condensate Field (Russia)', 'Yuzhno-Kirinskoye Field'),
  ).toBe(false);
  expect(similarStem('Vostochno-Urengoyskoye (Rospan) Asset', 'Urengoy gas field')).toBe(false);
  expect(similarStem('Kuzbass Asset', 'Kuz field')).toBe(false);
});
