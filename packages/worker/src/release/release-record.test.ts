import { expect, test } from 'vitest';

import type { Queryable } from '../queryable.ts';
import { readReleaseRecord } from './release-record.ts';

const figure = (id: string, document: string) => ({
  id,
  measure: 'price_test',
  value: '1',
  unit: 'USD',
  period: '2023-01',
  method: 'a method',
  publisher: 'A publisher',
  reporter: null,
  partner: null,
  product: null,
  subject_id: null,
  licence: 'cc0',
  document_id: document,
  page: 1,
  span_start: 0,
  span_end: 1,
});

// A database that answers each read of the release with a fixed list. The figures are made for
// the test.
const db: Queryable = {
  query: (text) => {
    const rows = (): unknown[] => {
      if (text.includes('release_observations'))
        return [
          figure('00000000-0000-4000-8000-000000000001', 'doc_000000000001'),
          figure('00000000-0000-4000-8000-000000000002', 'doc_000000000002'),
        ];
      if (text.includes('release_documents'))
        return [
          {
            id: 'doc_000000000001',
            title: 'A public table',
            uri: null,
            retrieved_at: null,
            licence: 'cc0',
            provider: null,
          },
        ];
      if (text.includes('release_disclaimer')) return [{ disclaimer: 'x' }];
      if (text.includes('name_candidate_counts'))
        return [{ proposed: 0, confirmed: 0, refused: 0 }];
      return [];
    };
    return Promise.resolve({ rows: rows() });
  },
};

test('a figure whose document is not a public document of the release is not exported', async () => {
  const record = await readReleaseRecord(db, { natoPair: false });
  expect((record.observations ?? []).map((one) => one.document_id)).toStrictEqual([
    'doc_000000000001',
  ]);
  expect([...record.documents.keys()]).toStrictEqual(['doc_000000000001']);
});
