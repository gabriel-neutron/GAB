import { expect, test } from 'vitest';
import { z } from 'zod';

import { csvExport } from './csv-export.ts';
import { geojsonExport } from './geojson-export.ts';
import type { ReleaseRecord } from './release-record.ts';

const SHIP = '00000000-0000-4000-8000-000000000001';
const OWNER = '00000000-0000-4000-8000-000000000002';
const PORT = '00000000-0000-4000-8000-000000000003';
const DEPOT = '00000000-0000-4000-8000-000000000004';
const ACT = '00000000-0000-4000-8000-000000000005';
const LABEL = 'Validated manually by the operator, on 2026-10-08';

const document = (id: string, licence: string | null, provider: string | null = null) => ({
  id,
  title: `The document ${id}`,
  uri: `https://example.org/${id}`,
  retrieved_at: '2026-10-01',
  licence,
  provider,
});

const PROPOSED = 'Proposed — not checked';

const listing = (
  id: string,
  source: string,
  from: string | null,
  to: string | null,
  type = 'designated_by',
  label = LABEL,
) => ({
  id,
  type,
  src_id: DEPOT,
  dst_id: OWNER,
  valid_from: from,
  valid_to: to,
  origin_label: label,
  sources: [source],
});

const RECORD: ReleaseRecord = {
  entities: [
    {
      id: SHIP,
      type: 'vessel',
      label: 'A ship',
      origin_label: LABEL,
      sources: ['doc_a', 'doc_b'],
      geom: { type: 'Point', coordinates: [32.5, 46.6] },
    },
    {
      id: OWNER,
      type: 'company',
      label: 'An owner',
      origin_label: LABEL,
      sources: ['doc_b'],
      geom: null,
    },
    {
      id: PORT,
      type: 'port',
      label: 'A port, "the old one"',
      origin_label: LABEL,
      sources: ['doc_b'],
      geom: {
        type: 'Polygon',
        coordinates: [
          [
            [30, 46],
            [31, 46],
            [31, 47],
            [30, 46],
          ],
        ],
      },
    },
    {
      id: DEPOT,
      type: 'facility',
      label: 'A depot',
      origin_label: LABEL,
      sources: ['doc_b'],
      geom: { type: 'Point', coordinates: [30.7, 46.4] },
    },
  ],
  relations: [
    listing('00000000-0000-4000-8000-0000000000a1', 'doc_eu', null, null),
    listing('00000000-0000-4000-8000-0000000000a2', 'doc_ofac', '2023-02-24', '2024-01-31'),
    listing(
      '00000000-0000-4000-8000-0000000000a3',
      'doc_uk',
      '2025-05-09',
      null,
      'restricted_by',
      PROPOSED,
    ),
  ],
  claims: [
    // The EU listing has no start: the entry into force of the act gives it.
    {
      claim_id: `${OWNER}/entry_into_force`,
      subject_kind: 'entity',
      subject_id: OWNER,
      attribute: 'entry_into_force',
      value: '2022-06-03',
      origin_label: LABEL,
      sources: ['doc_eu'],
      act_id: ACT,
      passages: [],
    },
    {
      claim_id: 'kind',
      subject_kind: 'entity',
      subject_id: DEPOT,
      attribute: 'asset_kind',
      value: 'oil_terminal',
      origin_label: LABEL,
      sources: ['doc_b'],
      act_id: ACT,
      passages: [],
    },
  ],
  merges: [],
  documents: new Map([
    ['doc_a', document('doc_a', 'public-domain')],
    ['doc_b', document('doc_b', null)],
    ['doc_eu', document('doc_eu', null, 'eu_eurlex')],
    ['doc_ofac', document('doc_ofac', null, 'ofac_sdn')],
    ['doc_uk', document('doc_uk', null, 'uk_sanctions_list')],
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

const collection = () => {
  const file = geojsonExport(RECORD, HEADING);
  expect(file.path).toBe('entities.geojson');
  return z
    .looseObject({
      features: z.array(z.object({ properties: z.record(z.string(), z.unknown()) }).loose()),
    })
    .parse(JSON.parse(file.text));
};

test('the GeoJSON holds one feature for each entity with a position, in longitude and latitude order', () => {
  const read = collection();
  expect(read['type']).toBe('FeatureCollection');
  expect(read.features).toHaveLength(3);
  expect(read.features[0]).toMatchObject({
    type: 'Feature',
    id: SHIP,
    geometry: { type: 'Point', coordinates: [32.5, 46.6] },
  });
  expect(read.features[1]).toMatchObject({ id: PORT, geometry: { type: 'Polygon' } });
  // RFC 7946 removed the member that names a coordinate system: the system is always WGS84.
  expect(read).not.toHaveProperty('crs');
});

test('the properties of a feature are the columns of the entity CSV, with the same values', () => {
  const csv = csvExport(RECORD, '').find((file) => file.path === 'entities.csv')?.text ?? '';
  const [header] = csv.slice(1).split('\r\n');
  expect(collection().features[0]).toMatchObject({
    properties: {
      id: SHIP,
      type: 'vessel',
      label: 'A ship',
      origin_label: LABEL,
      licence: 'CC-BY 4.0',
      document_ids: 'doc_a doc_b',
    },
  });
  const [first] = collection().features;
  expect(Object.keys(first?.properties ?? {})).toStrictEqual([
    ...(header?.split(',') ?? []),
    'asset_kind',
  ]);
  expect(collection().features[1]).toMatchObject({
    properties: {
      label: 'A port, "the old one"',
      licence: 'derived fact; source under the provider licence, not redistributed',
    },
  });
});

test('a facility carries its asset kind and its dated measures for each regime, with the act and the label', () => {
  const depot = collection().features.find((one) => one['id'] === DEPOT);
  const act = { act_id: OWNER, act_label: 'An owner' };
  expect(depot?.properties).toMatchObject({
    asset_kind: 'oil_terminal',
    sanctions: {
      eu: [
        {
          measure: 'designated_by',
          from: '2022-06-03',
          to: null,
          ...act,
          act_document: 'The document doc_eu',
          origin_label: LABEL,
        },
      ],
      us: [{ measure: 'designated_by', from: '2023-02-24', to: '2024-01-31', ...act }],
      uk: [
        {
          measure: 'restricted_by',
          from: '2025-05-09',
          to: null,
          ...act,
          act_document: 'The document doc_uk',
          origin_label: PROPOSED,
        },
      ],
    },
  });
  // Another entity has no sanctions member, and no asset kind.
  expect(collection().features[0]?.properties).toMatchObject({ asset_kind: null });
  expect(collection().features[0]?.properties).not.toHaveProperty('sanctions');
});

test('the collection carries the version and the disclaimer of the release', () => {
  expect(collection()).toMatchObject({
    name: 'GAB dataset, version 1.0 of 08/11/2026.',
    disclaimer: 'About this data.',
  });
});
