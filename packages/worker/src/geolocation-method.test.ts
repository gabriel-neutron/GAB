import { expect, test } from 'vitest';

import { fillGeolocationMethods, methodReportLines } from './geolocation-method.ts';
import type { Queryable } from './queryable.ts';

const SITE = '00000000-0000-4000-8000-000000000001';
const PORT = '00000000-0000-4000-8000-000000000002';
const PLANT = '00000000-0000-4000-8000-000000000003';
const LOST = '00000000-0000-4000-8000-000000000004';

const PLACES = [
  { id: SITE, label: 'A site', docs: ['doc_gem'] },
  { id: PORT, label: 'A port', docs: ['doc_news'] },
  { id: PLANT, label: 'A plant', docs: ['doc_gem', 'doc_way'] },
  { id: LOST, label: 'A lost source', docs: ['doc_gem', 'doc_gone'] },
];

const DOCUMENTS = [
  { id: 'doc_gem', title: 'Global Energy Monitor tracker', uri: null, provider_id: null },
  { id: 'doc_news', title: 'A ship was seized', uri: 'https://example.org/a', provider_id: null },
  { id: 'doc_way', title: 'Way 61412496', uri: null, provider_id: 'osm' },
];

// A database that holds the places and the documents, and records each write.
const database = (): { db: Queryable; writes: string[][] } => {
  const writes: string[][] = [];
  const db: Queryable = {
    query: (text, values = []) => {
      if (text.includes('fill_geolocation_method')) {
        writes.push(values.map(String));
        return Promise.resolve({ rows: [{ done: true }] });
      }
      return Promise.resolve({ rows: text.includes('FROM public.documents') ? DOCUMENTS : PLACES });
    },
  };
  return { db, writes };
};

test('a place whose documents state one method gets it, and the others stay not_stated', async () => {
  const { db, writes } = database();
  const report = await fillGeolocationMethods(db, false);
  expect(writes).toStrictEqual([[SITE, 'source_coordinates']]);
  expect(report).toMatchObject({ dryRun: false, read: 4 });
  expect(methodReportLines(report)).toStrictEqual([
    `set the method of ${SITE} (A site) to source_coordinates`,
    '4 places with no stated method read, 1 set, 3 stay not_stated.',
  ]);
});

test('a dry run names the change and writes nothing', async () => {
  const { db, writes } = database();
  const report = await fillGeolocationMethods(db, true);
  expect(writes).toStrictEqual([]);
  expect(methodReportLines(report)).toStrictEqual([
    `would set the method of ${SITE} (A site) to source_coordinates`,
    'Dry run: 4 places with no stated method read, 1 to set, 3 stay not_stated.',
  ]);
});
