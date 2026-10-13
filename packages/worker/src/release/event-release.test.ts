import { expect, test } from 'vitest';

import { csvExport } from './csv-export.ts';
import { geojsonExport } from './geojson-export.ts';
import type { ReleaseRecord } from './release-record.ts';

const EVENT = '00000000-0000-4000-8000-0000000000e1';
const NAME = 'claimed attack — Afipsky refinery — 2026-05-15';

const RECORD: ReleaseRecord = {
  entities: [
    {
      id: EVENT,
      type: 'event',
      label: NAME,
      origin_label: 'Validated manually by the operator, on 2026-10-08',
      sources: ['doc_a'],
      geom: null,
    },
  ],
  relations: [],
  claims: [],
  merges: [],
  documents: new Map([
    [
      'doc_a',
      {
        id: 'doc_a',
        title: 'A post',
        uri: 'https://example.org/a',
        retrieved_at: '2026-10-01',
        licence: 'public-domain',
        provider: null,
      },
    ],
  ]),
  nameCandidates: { proposed: 0, confirmed: 0, refused: 0 },
  disclaimer: '',
  natoPairs: null,
};

const HEADING = {
  version: '1.0',
  date: '2026-11-08',
  title: 'GAB dataset, version 1.0 of 08/11/2026.',
  disclaimer: 'About this data.',
};

test('an event is a row of the entity CSV', () => {
  const csv = csvExport(RECORD, '').find((file) => file.path === 'entities.csv')?.text ?? '';
  expect(csv).toContain(NAME);
  expect(csv).toContain(',event,');
});

test('an event has no position, so the GeoJSON of the map holds no feature for it', () => {
  expect(JSON.parse(geojsonExport(RECORD, HEADING).text)).toMatchObject({ features: [] });
});
