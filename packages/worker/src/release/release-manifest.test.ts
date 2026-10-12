import { expect, test } from 'vitest';

import { readReleaseManifest, ReleaseManifestFault } from './release-manifest.ts';

const CONTACTS = {
  reportError: 'https://example.org/report',
  rightOfReply: 'mailto:reply@example.org',
};

const TODAY = new Date('2026-11-08T21:30:00Z');

const read = (manifest: unknown) => readReleaseManifest(JSON.stringify(manifest), TODAY);

test('a manifest with the contact addresses alone takes a default for each other value', () => {
  expect(read({ contacts: CONTACTS })).toStrictEqual({
    version: '2026-11-08',
    date: '2026-11-08',
    showNatoPair: false,
    dateRules: { eu: 'entry_into_force', ofac: 'recent_actions_notice', uk: 'date_designated' },
    contacts: CONTACTS,
    criticalNodes: null,
    iriBase: 'https://github.com/gabriel-neutron/GAB/id/',
  });
});

test('a manifest keeps the values that it gives', () => {
  expect(
    read({
      version: '1.0',
      date: '2026-11-01',
      showNatoPair: false,
      contacts: CONTACTS,
      criticalNodes: 'nodes.csv',
      iriBase: 'https://data.example.org/gab/',
    }),
  ).toMatchObject({
    version: '1.0',
    date: '2026-11-01',
    criticalNodes: 'nodes.csv',
    iriBase: 'https://data.example.org/gab/',
  });
});

test.each([
  ['no contact address', {}],
  ['one contact address only', { contacts: { reportError: CONTACTS.reportError } }],
  ['a blank contact address', { contacts: { ...CONTACTS, rightOfReply: ' ' } }],
  ['a contact address that is not a link', { contacts: { ...CONTACTS, reportError: 'a team' } }],
  ['a contact address on plain http', { contacts: { ...CONTACTS, reportError: 'http://x.org' } }],
  ['a quote in a contact address', { contacts: { ...CONTACTS, reportError: 'https://x.org/"a' } }],
  ['a comma in a contact address', { contacts: { ...CONTACTS, reportError: 'https://x.org/a,b' } }],
  [
    'a control character in a contact address',
    { contacts: { ...CONTACTS, rightOfReply: 'https://x.org/\u0007' } },
  ],
])('the manifest is refused with %s', (_, manifest) => {
  expect(() => read(manifest)).toThrow(ReleaseManifestFault);
  expect(() => read(manifest)).toThrow(/contacts/u);
});

test('a date that is not a day of the calendar is refused', () => {
  expect(() => read({ contacts: CONTACTS, date: '2026-02-30' })).toThrow(/date/u);
});

test('a key that the manifest does not know is refused, so a wrong spelling does not pass', () => {
  expect(() => read({ contacts: CONTACTS, showNatopair: true })).toThrow(/showNatopair/u);
});

test('the NATO pair is off by default, and the operator can turn it on', () => {
  expect(read({ contacts: CONTACTS }).showNatoPair).toBe(false);
  expect(read({ contacts: CONTACTS, showNatoPair: true }).showNatoPair).toBe(true);
});

test('a NATO pair parameter that is not true or false is refused', () => {
  expect(() => read({ contacts: CONTACTS, showNatoPair: 'yes' })).toThrow(/showNatoPair/u);
});

test('a text that is not JSON is refused with a short message', () => {
  expect(() => readReleaseManifest('not json', TODAY)).toThrow(/not valid JSON/u);
});

test.each(['1,0', 'the "first"', 'one\ntwo', 'a\u0000b'])(
  'a version with a quote, a comma or a control character (%j) is refused',
  (version) => {
    expect(() => read({ contacts: CONTACTS, version })).toThrow(/version/u);
  },
);

test.each([
  'http://data.example.org/gab/',
  'https://data.example.org/gab',
  'https://data.example.org/gab/#',
  'https://data.example.org/gab/?a=1/',
  'https://data.example.org/a b/',
  'data.example.org/gab/',
])(
  'a base of the identifiers that is not an https address that ends with a slash (%j) is refused',
  (iriBase) => {
    expect(() => read({ contacts: CONTACTS, iriBase })).toThrow(/iriBase/u);
  },
);
