import { expect, test } from 'vitest';

import { documentType, DOCUMENT_TYPES, hostOf } from './document-type.ts';

test.each([
  [
    'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R0012',
    'Regulation',
    'legal_act',
  ],
  ['https://www.federalregister.gov/documents/2026/05/03/x/designations', 'Notice', 'legal_act'],
  ['https://www.legislation.gov.uk/uksi/2026/12/made', 'The Order 2026', 'legal_act'],
  ['https://example.org/a', 'Council Implementing Regulation (EU) 2026/12', 'legal_act'],
  ['https://example.org/a', 'Executive Order 14024', 'legal_act'],
  ['https://sanctionslistservice.ofac.treas.gov/api/x/SDN.CSV', 'SDN list', 'register_entry'],
  [
    'https://find-and-update.company-information.service.gov.uk/company/123',
    'Co',
    'register_entry',
  ],
  ['https://search.gleif.org/#/record/5493001KJTIIGC8Y1R12', 'Record', 'register_entry'],
  ['https://home.treasury.gov/news/press-releases/jy1234', 'Treasury action', 'press_release'],
  ['https://example.org/a', 'Press release: a new designation', 'press_release'],
  ['https://example.org/media/news/2026/ship', 'A ship was seized', 'press_release'],
  ['https://example.org/files/annual.pdf', 'Annual report 2025', 'report'],
  ['https://example.org/reports/2025', 'Overview', 'report'],
  ['https://example.org/a', 'A page', 'other'],
  [null, 'A note', 'other'],
])('the type of %s with the title %s is %s', (uri, title, type) => {
  expect(documentType({ uri, title, provider: null })).toBe(type);
});

test('a provider of an official list decides the type', () => {
  expect(documentType({ uri: null, title: 'x', provider: 'ofac_sdn' })).toBe('register_entry');
  expect(documentType({ uri: null, title: 'x', provider: 'uk_sanctions_list' })).toBe(
    'register_entry',
  );
  expect(documentType({ uri: null, title: 'x', provider: 'eu_eurlex' })).toBe('legal_act');
});

test('each type is one of the five', () => {
  expect(DOCUMENT_TYPES).toStrictEqual([
    'legal_act',
    'register_entry',
    'press_release',
    'report',
    'other',
  ]);
});

test('the host of an address has no www, and a bad address has none', () => {
  expect(hostOf('https://www.example.org/a?b=1')).toBe('example.org');
  expect(hostOf('https://Sub.Example.org:8080/a')).toBe('sub.example.org');
  expect(hostOf('not an address')).toBeNull();
  expect(hostOf(null)).toBeNull();
});
