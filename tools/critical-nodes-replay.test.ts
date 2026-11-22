import { expect, test } from 'vitest';

import {
  count,
  countryCodes,
  daysOf,
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

// Downloads the release of the report once (7.6 MB, checked by its SHA-256) and pins the count.
test(
  'gives the count of the report on the release data-2026-10-28',
  { timeout: 300_000 },
  async () => {
    const result = count(replay(readRelease(await reportRelease())));
    expect(result).toEqual({
      critical: 539,
      official: 410,
      byLayer: { Pay: 488, Finance: 4, Fight: 47 },
    });
  },
);
