import { expect, test } from 'vitest';

import { relabelDocuments, reportLines } from './document-labels.ts';
import type { Queryable } from './queryable.ts';

interface Held {
  readonly id: string;
  readonly title: string;
  readonly uri: string | null;
  readonly doc_type: string;
  readonly provider_id: string | null;
  readonly first_page: string | null;
}

const held = (given: Partial<Held> & { id: string }): Held => ({
  title: 'A readable title',
  uri: 'https://example.org/a',
  doc_type: 'other',
  provider_id: null,
  first_page: null,
  ...given,
});

// A database that holds the documents, and records each write.
const database = (rows: readonly Held[]): { db: Queryable; writes: string[][] } => {
  const writes: string[][] = [];
  const db: Queryable = {
    query: (text, values = []) => {
      if (text.includes('correct_document_title')) {
        writes.push(['title', ...values.map(String)]);
        return Promise.resolve({ rows: [{ done: true }] });
      }
      if (text.includes('fill_document_type')) {
        writes.push(['type', ...values.map(String)]);
        return Promise.resolve({ rows: [{ done: true }] });
      }
      return Promise.resolve({ rows: [...rows] });
    },
  };
  return { db, writes };
};

const ROWS: readonly Held[] = [
  held({
    id: 'doc_1',
    title: 'example.org/files/act.pdf',
    uri: 'https://example.org/files/act.pdf',
    first_page: 'COUNCIL REGULATION (EU) 2026/12\nof 3 May 2026',
  }),
  held({ id: 'doc_2', title: 'Press release: a designation', uri: 'https://example.org/a' }),
  held({ id: 'doc_3', title: 'A page', doc_type: 'report' }),
  held({ id: 'doc_4', title: 'google.com/search', uri: 'https://www.google.com/search?q=ship' }),
  held({ id: 'doc_5', title: 'A note', uri: null }),
];

test('a weak title takes the first line, a type is filled, and a search page is listed', async () => {
  const { db, writes } = database(ROWS);
  const report = await relabelDocuments(db, false);
  expect(writes).toStrictEqual([
    ['title', 'doc_1', 'example.org/files/act.pdf', 'COUNCIL REGULATION (EU) 2026/12'],
    ['title', 'doc_4', 'google.com/search', 'search'],
    ['type', 'doc_1', 'legal_act'],
    ['type', 'doc_2', 'press_release'],
  ]);
  expect(report.searchPages.map((one) => one.document)).toStrictEqual(['doc_4']);
  expect(report.read).toBe(5);
});

test('a dry run writes nothing and reports the same changes', async () => {
  const { db, writes } = database(ROWS);
  const report = await relabelDocuments(db, true);
  expect(writes).toStrictEqual([]);
  expect(report.titles).toHaveLength(2);
  expect(report.types).toHaveLength(2);
});

test('a type that is set stays, and a title that is readable stays', async () => {
  const { db, writes } = database([
    held({ id: 'doc_3', title: 'Annual report 2025', doc_type: 'legal_act' }),
  ]);
  await relabelDocuments(db, false);
  expect(writes).toStrictEqual([]);
});

test('the report names each change and each search page, and deletes nothing', async () => {
  const { db } = database(ROWS);
  const lines = reportLines(await relabelDocuments(db, true));
  expect(lines).toContain(
    'would set the title of document doc_1 to "COUNCIL REGULATION (EU) 2026/12"',
  );
  expect(lines).toContain('would set the type of document doc_2 to press_release');
  expect(lines.some((line) => line.includes('doc_4') && line.includes('search'))).toBe(true);
  expect(lines.at(-1)).toMatch(/^Dry run: 5 documents read/u);
});
