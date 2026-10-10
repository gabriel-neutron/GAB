import { expect, test } from 'vitest';
import { z } from 'zod';

import { csvExport } from './csv-export.ts';
import { geojsonExport } from './geojson-export.ts';
import type { ReleaseRecord } from './release-record.ts';

const SHIP = '00000000-0000-4000-8000-000000000001';
const OWNER = '00000000-0000-4000-8000-000000000002';
const PORT = '00000000-0000-4000-8000-000000000003';
const LABEL = 'Validated manually by the operator, on 2026-10-08';

const document = (id: string, licence: string | null) => ({
  id,
  title: `The document ${id}`,
  uri: `https://example.org/${id}`,
  retrieved_at: '2026-10-01',
  licence,
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
  ],
  relations: [],
  claims: [],
  merges: [],
  documents: new Map([
    ['doc_a', document('doc_a', 'public-domain')],
    ['doc_b', document('doc_b', null)],
  ]),
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
      features: z.array(z.object({ properties: z.record(z.string(), z.string()) }).loose()),
    })
    .parse(JSON.parse(file.text));
};

test('the GeoJSON holds one feature for each entity with a position, in longitude and latitude order', () => {
  const read = collection();
  expect(read['type']).toBe('FeatureCollection');
  expect(read.features).toHaveLength(2);
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
  expect(Object.keys(first?.properties ?? {})).toStrictEqual(header?.split(','));
  expect(collection().features[1]).toMatchObject({
    properties: {
      label: 'A port, "the old one"',
      licence: 'derived fact; source under the provider licence, not redistributed',
    },
  });
});

test('the collection carries the version and the disclaimer of the release', () => {
  expect(collection()).toMatchObject({
    name: 'GAB dataset, version 1.0 of 08/11/2026.',
    disclaimer: 'About this data.',
  });
});
