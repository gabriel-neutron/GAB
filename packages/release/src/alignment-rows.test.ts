import { expect, test } from 'vitest';

import { readAlignmentRows } from './alignment-rows.ts';

const REGIMES = ['eu', 'ofac', 'uk'];
const COLUMNS = [
  'listed_on',
  'date_from',
  'date_claim_id',
  'ended_on',
  'act_id',
  'act_label',
  'document_ids',
  'claim_id',
];
const HEADER = [
  'imo',
  'vessel_ids',
  'vessel_labels',
  ...REGIMES.flatMap((regime) => COLUMNS.map((column) => `${regime}_${column}`)),
  'ofac_or_uk_not_eu',
  'eu_not_ofac',
].join(',');

const none = COLUMNS.map(() => '');
const row = (cells: readonly (readonly string[])[], marks: readonly string[]): string =>
  ['9000001', 'v1', '"[""Vessel One""]"', ...cells.flat(), ...marks].join(',');

const EU = ['2024-02-23', 'designation_start', 'c-d', '', 'act-eu', 'Act EU', 'doc1', 'c-eu'];

test('a regime that names an act lists the number, and an empty regime does not', () => {
  const [one] = readAlignmentRows(
    `# note\n\n${HEADER}\n${row([EU, none, none], ['false', 'true'])}\n`,
  );
  expect(one?.imo).toBe('9000001');
  expect(one?.vesselLabels).toStrictEqual(['Vessel One']);
  expect(one?.listings.eu).toStrictEqual({
    listedOn: '2024-02-23',
    endedOn: null,
    actId: 'act-eu',
    actLabel: 'Act EU',
    claimId: 'c-eu',
  });
  expect(one?.listings.ofac).toBeNull();
  expect(one?.euNotOfac).toBe(true);
  expect(one?.ofacOrUkNotEu).toBe(false);
});

test('a listing with no date keeps its act', () => {
  const undated = EU.map((cell, place) => (place === 0 ? '' : cell));
  const [one] = readAlignmentRows(`${HEADER}\n${row([none, undated, none], ['true', 'false'])}\n`);
  expect(one?.listings.ofac?.listedOn).toBeNull();
  expect(one?.listings.ofac?.actId).toBe('act-eu');
});

test('a file without a column stops the read', () => {
  expect(() => readAlignmentRows('imo\n1\n')).toThrow(/no column/u);
});
