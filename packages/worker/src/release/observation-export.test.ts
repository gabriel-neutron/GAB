import { readCsv } from '@gab/tools/csv';
import { expect, test } from 'vitest';

import { observationExport } from './observation-export.ts';
import type { ReleaseRecord } from './release-record.ts';

const DOCUMENT = 'doc_000000000001';

// The records of the file below the comment lines, each as its header names.
const readRows = (text: string): Record<string, string>[] => {
  const [header, ...rows] = readCsv(text).filter((one) => !(one.fields[0] ?? '').startsWith('#'));
  return rows.map((row) =>
    Object.fromEntries((header?.fields ?? []).map((name, at) => [name, row.fields[at] ?? ''])),
  );
};

// A record with one figure of the world and one figure of a country. The values are made for the
// test and are not data of the research.
const record = {
  observations: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      measure: 'price_test',
      value: '82.5',
      unit: 'USD per barrel',
      period: '2023-01',
      method: 'monthly average',
      publisher: 'A publisher',
      reporter: null,
      partner: null,
      product: null,
      subject_id: null,
      licence: 'cc-by-4.0',
      document_id: DOCUMENT,
      page: 1,
      span_start: 10,
      span_end: 14,
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      measure: 'imports_test',
      value: '-3.2',
      unit: 'MIO_M3',
      period: '2023-02',
      method: 'imports reported by the importer',
      publisher: 'A publisher',
      reporter: 'DE',
      partner: 'RU',
      product: 'G3000',
      subject_id: null,
      licence: 'cc-by-nc-4.0',
      document_id: DOCUMENT,
      page: 1,
      span_start: 20,
      span_end: 24,
    },
  ],
  documents: new Map([
    [
      DOCUMENT,
      {
        id: DOCUMENT,
        title: 'A table',
        uri: 'https://example.org/t',
        retrieved_at: null,
        licence: null,
        provider: null,
      },
    ],
  ]),
} as unknown as ReleaseRecord;

test('the figures file has one row for each figure, with its source and its licence', () => {
  const file = observationExport(record, 'Title');
  expect(file.path).toBe('observations.csv');
  const rows = readRows(file.text);
  expect(
    rows.map((row) => [row['measure'], row['reporter'], row['value'], row['licence']]),
  ).toStrictEqual([
    ['price_test', '', '82.5', 'CC-BY 4.0'],
    ['imports_test', 'DE', '-3.2', 'CC-BY-NC 4.0'],
  ]);
  expect(rows[0]).toMatchObject({ document_title: 'A table', page: '1', span_start: '10' });
});

test('a record with no figure gives a file with no row', () => {
  expect(readRows(observationExport({} as ReleaseRecord, '').text)).toStrictEqual([]);
});
