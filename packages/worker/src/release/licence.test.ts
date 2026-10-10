import { expect, test } from 'vitest';

import { rowLicence } from './licence.ts';

const DERIVED = 'derived fact; source under the provider licence, not redistributed';

test.each([
  [['public-domain'], 'CC-BY 4.0'],
  [['eu-reuse'], 'CC-BY 4.0'],
  [['ogl-v3'], 'CC-BY 4.0'],
  [['cc0'], 'CC-BY 4.0'],
  [['cc-by-4.0'], 'CC-BY 4.0'],
  [['cc-by-nc-4.0'], 'CC-BY-NC 4.0'],
  [['commercial-no-redistribution'], DERIVED],
  [['registration-terms'], DERIVED],
  [['odbl'], DERIVED],
  [[null], DERIVED],
  [['a word that a later migration adds'], DERIVED],
  [[], DERIVED],
])('the documents %j give the row the licence "%s"', (licences, expected) => {
  expect(rowLicence(licences)).toBe(expected);
});

test('a row takes the most permissive licence of its documents', () => {
  expect(rowLicence(['restricted', 'cc-by-nc-4.0', null])).toBe('CC-BY-NC 4.0');
  expect(rowLicence(['cc-by-nc-4.0', 'public-domain'])).toBe('CC-BY 4.0');
});
