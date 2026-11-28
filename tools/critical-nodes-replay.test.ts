import { expect, test } from 'vitest';

import {
  count,
  countryCodes,
  daysOf,
  partyOnly,
  readRelease,
  replay,
  reportRelease,
  type ReleaseFiles,
} from './critical-nodes-replay.ts';

test('maps the country names of the release to ISO codes', () => {
  expect(countryCodes('Hong Kong')).toEqual(['HK']);
  expect(countryCodes('Republic of Türkiye')).toEqual(['TR']);
  expect(countryCodes('["Barbados","Gabon"]')).toEqual(['BB', 'GA']);
  expect(countryCodes('RU')).toEqual(['RU']);
  expect(countryCodes('Dubai Internet City, United Arab Emirates')).toEqual([]);
});

// A deprecated code (SU, UK, FX, DD, YU, VD, BU) has the same English name as its current code. The
// table must keep the current code, and a deprecated code in a value gives the current code.
test('maps a country name to its current ISO code, never to a deprecated one', () => {
  expect(countryCodes('Russia')).toEqual(['RU']);
  expect(countryCodes('United Kingdom')).toEqual(['GB']);
  expect(countryCodes('France')).toEqual(['FR']);
  expect(countryCodes('Germany')).toEqual(['DE']);
  expect(countryCodes('Serbia')).toEqual(['RS']);
  expect(countryCodes('Vietnam')).toEqual(['VN']);
  expect(countryCodes('Myanmar (Burma)')).toEqual(['MM']);
  expect(countryCodes('Benin')).toEqual(['BJ']);
  expect(countryCodes('["SU","UK"]')).toEqual(['RU', 'GB']);
  // The map of a deprecated code comes from the ICU data of Node: a change of that data fails here.
  expect(countryCodes('["CS","TP","ZR"]')).toEqual(['RS', 'TL', 'CD']);
});

test('reads a date as a list or as the head of an OFAC action id', () => {
  expect(daysOf('["2026-06-12"]')).toEqual(['2026-06-12']);
  expect(daysOf('20261231_01')).toEqual(['2026-12-31']);
  expect(() => daysOf('[1]')).toThrow(/not a list of strings/);
});

const row = (fields: Record<string, string>) => fields;

test('groups vessels under their manager and applies the three conditions', () => {
  const files: ReleaseFiles = {
    entities: [
      row({ id: 'm', type: 'company' }),
      row({ id: 'v1', type: 'vessel' }),
      row({ id: 'v2', type: 'vessel' }),
      row({ id: 'act', type: 'legal_act' }),
      row({ id: 'ru', type: 'company' }),
      row({ id: 'plant', type: 'facility' }),
      row({ id: 'attack', type: 'event' }),
    ],
    relations: [
      row({ type: 'operates', from_id: 'm', to_id: 'v1', valid_from: '', valid_to: '', share: '' }),
      row({ type: 'operates', from_id: 'm', to_id: 'v2', valid_from: '', valid_to: '', share: '' }),
      row({
        type: 'designated_by',
        from_id: 'v1',
        to_id: 'act',
        valid_from: '',
        valid_to: '',
        share: '',
      }),
      row({
        type: 'designated_by',
        from_id: 'plant',
        to_id: 'old',
        valid_from: '',
        valid_to: '',
        share: '',
      }),
      row({
        type: 'occurred_at',
        from_id: 'attack',
        to_id: 'plant',
        valid_from: '',
        valid_to: '',
        share: '',
      }),
      row({
        type: 'designated_by',
        from_id: 'ru',
        to_id: 'act',
        valid_from: '',
        valid_to: '',
        share: '',
      }),
    ],
    claims: [
      row({
        claim_kind: 'attribute',
        subject_id: 'attack',
        attribute: 'occurred_on',
        value: '["2025-03-01"]',
        nato_letter: 'C',
      }),
      row({
        claim_kind: 'attribute',
        subject_id: 'plant',
        attribute: 'country',
        value: 'Kazakhstan',
        nato_letter: 'A',
      }),
      row({
        claim_kind: 'attribute',
        subject_id: 'act',
        attribute: 'entry_into_force',
        value: '2025-05-20',
        nato_letter: 'A',
      }),
      row({
        claim_kind: 'attribute',
        subject_id: 'v2',
        attribute: 'flag_history',
        value: 'Gabon',
        nato_letter: 'A',
      }),
      row({
        claim_kind: 'relation',
        subject_id: 'v1',
        relation_type: 'designated_by',
        object_id: 'act',
        nato_letter: 'A',
      }),
      row({
        claim_kind: 'attribute',
        subject_id: 'ru',
        attribute: 'registration_jurisdiction',
        value: 'RU',
        nato_letter: 'A',
      }),
    ],
  };
  // The manager and its two vessels are one node; Russia is not a third country. The plant is
  // active by a dated event, and the date of the event has no document of letter A.
  expect(count(replay(files))).toEqual({
    critical: 2,
    official: 1,
    byLayer: { Pay: 1, Finance: 0, Fight: 1 },
  });
});

test('reads a date that the release gives as a claim of the relation', () => {
  const relation = (id: string, to: string) =>
    row({
      id: `r${id}`,
      type: 'designated_by',
      from_id: id,
      to_id: to,
      valid_from: '',
      valid_to: '',
    });
  const files: ReleaseFiles = {
    entities: [
      row({ id: 'act', type: 'legal_act' }),
      row({ id: 'x', type: 'company' }),
      row({ id: 'y', type: 'company' }),
      row({ id: 'z', type: 'company' }),
    ],
    // The act has no date, so only a claim of the relation can make the relation active.
    relations: [relation('x', 'act'), relation('y', 'act'), relation('z', 'act')],
    claims: [
      ...['x', 'y', 'z'].flatMap((id) => [
        row({
          claim_kind: 'attribute',
          subject_id: id,
          attribute: 'country',
          value: 'Kazakhstan',
          nato_letter: 'A',
        }),
        row({
          claim_id: id,
          claim_kind: 'relation',
          subject_kind: 'entity',
          subject_id: id,
          relation_type: 'designated_by',
          object_id: 'act',
          nato_letter: 'A',
        }),
      ]),
      // x: a day of letter A. y: a day of letter C. z: a value that is not a day.
      row({
        claim_id: 'rx/valid_from',
        claim_kind: 'attribute',
        subject_kind: 'relation',
        subject_id: 'rx',
        attribute: 'valid_from',
        value: '2025-01-10',
        nato_letter: 'A',
      }),
      row({
        claim_id: 'ry/valid_to',
        claim_kind: 'attribute',
        subject_kind: 'relation',
        subject_id: 'ry',
        attribute: 'valid_to',
        value: '2026-02-27',
        nato_letter: 'C',
      }),
      row({
        claim_id: 'rz/valid_from',
        claim_kind: 'attribute',
        subject_kind: 'relation',
        subject_id: 'rz',
        attribute: 'valid_from',
        value: 'January 2025',
        nato_letter: 'A',
      }),
    ],
  };
  const nodes = new Map(replay(files).map((one) => [one.id, one]));
  expect(nodes.get('x')).toMatchObject({ b: true, official: true });
  expect(nodes.get('y')).toMatchObject({ b: true, official: false });
  expect(nodes.get('z')).toMatchObject({ b: false });
});

const GUR = 'https://war-sanctions.gur.gov.ua/en/transport/ships/1';
const OFAC = 'https://sanctionslistservice.ofac.treas.gov/changes/1';

test('counts apart what a critical node owes to facts of a party to the conflict', () => {
  const relation = (id: string, type: string, from: string, to: string, valid_from = '') =>
    row({ id, type, from_id: from, to_id: to, valid_from, valid_to: '', share: '' });
  const claim = (claim_id: string, address: string, more: Record<string, string> = {}) =>
    row({ claim_id, claim_kind: 'relation', document_address: address, ...more });
  const files: ReleaseFiles = {
    entities: [
      row({ id: 'm', type: 'company' }),
      row({ id: 'v', type: 'vessel' }),
      row({ id: 'act', type: 'legal_act' }),
    ],
    relations: [
      // Only GUR names the manager, so the vessel joins the node m through a party fact.
      relation('op', 'operates', 'm', 'v'),
      relation('des', 'designated_by', 'v', 'act', '2025-01-01'),
    ],
    claims: [
      claim('op', GUR, { subject_id: 'm', relation_type: 'operates', object_id: 'v' }),
      claim('des', OFAC, { subject_id: 'v', relation_type: 'designated_by', object_id: 'act' }),
      // The only country of the vessel comes from GUR, so condition (c) rests on it alone.
      claim('v/flag', GUR, {
        claim_kind: 'attribute',
        subject_id: 'v',
        attribute: 'flag_history',
        value: 'Gabon',
      }),
    ],
  };
  const result = partyOnly(files);
  expect(result.facts).toBe(2);
  expect(result.condition.critical).toBe(1);
  expect(result.condition.byCondition).toEqual({ a: 0, b: 0, c: 1 });
  expect(result.members.critical).toBe(1);
  // A second document of another publisher makes the facts no longer facts of a party.
  const both = [
    ...files.claims,
    claim('op', OFAC),
    claim('v/flag', OFAC, { claim_kind: 'attribute' }),
  ];
  const corroborated = partyOnly({ ...files, claims: both });
  expect(corroborated.facts).toBe(0);
  expect(corroborated.condition.critical).toBe(0);
  expect(corroborated.members.critical).toBe(0);
  // Only GUR ends the manager relation (the relation itself has an OFAC document). Without the
  // party facts the vessel stays in the node m, so it leaves m only through a party fact.
  const ended = partyOnly({
    ...files,
    claims: [
      ...both,
      claim('op/valid_to', GUR, {
        claim_kind: 'attribute',
        subject_kind: 'relation',
        subject_id: 'op',
        attribute: 'valid_to',
        value: '2025-06-01',
      }),
    ],
  });
  expect(ended.members.critical).toBe(1);
});

// Downloads the release of the report once (7.6 MB, checked by its SHA-256) and pins the count.
test(
  'gives the count of the report on the release data-2026-11-29',
  { timeout: 300_000 },
  async () => {
    const files = readRelease(await reportRelease());
    expect(count(replay(files))).toEqual({
      critical: 637,
      official: 572,
      byLayer: { Pay: 413, Finance: 7, Fight: 217 },
    });
    const party = partyOnly(files);
    expect(party.facts).toBe(8371);
    expect(party.condition.critical).toBe(2);
    expect(party.members.critical).toBe(74);
  },
);
