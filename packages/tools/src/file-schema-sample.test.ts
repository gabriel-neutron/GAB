import { expect, test } from 'vitest';

import { headerSignature } from './csv.ts';
import { fileSchemaSample } from './file-schema-sample.ts';
import { callTool, ToolRefusal, type Session } from './tool.ts';
import { tableOf } from './table.ts';

const page = (rows: number): string =>
  [
    'Name,IMO,Built',
    ...Array.from({ length: rows }, (_, i) => `Hull ${String(i + 1)},${String(9100000 + i)},2001`),
  ].join('\n');

// A session that holds one page of text, whatever the query asks.
const holding = (...pages: string[]): Session => ({
  query: () =>
    Promise.resolve({
      rows: pages.map((text, index) => ({ extractor: 'set@1', page: index + 1, text })),
    }),
});

test('the sample is the header, the signature, the count of rows and the first twenty rows', async () => {
  const read = await callTool(fileSchemaSample, holding(page(200)), { document: 'doc_a' });
  expect(read).toMatchObject({
    ok: true,
    output: {
      document: 'doc_a',
      header: ['Name', 'IMO', 'Built'],
      headerSig: headerSignature(['Name', 'IMO', 'Built']),
      rowCount: 200,
    },
  });
  const rows = read.ok ? (read.output as { rows: { row: number; values: string[] }[] }).rows : [];
  expect(rows).toHaveLength(20);
  expect(rows[0]).toStrictEqual({ row: 1, values: ['Hull 1', '9100000', '2001'] });
  expect(rows[19]?.row).toBe(20);
});

test('a table of fewer than twenty rows gives every row, and a long cell is cut', async () => {
  const long = 'x'.repeat(500);
  const read = await callTool(fileSchemaSample, holding(`a,b\n1,${long}\n2,3`), {
    document: 'doc_a',
  });
  const rows = read.ok ? (read.output as { rows: { values: string[] }[] }).rows : [];
  expect(rows).toHaveLength(2);
  expect(rows[0]?.values[1]).toHaveLength(200);
});

test('a document with no text, or with more than one page, is refused with a sentence', async () => {
  expect(await callTool(fileSchemaSample, holding(), { document: 'doc_a' })).toStrictEqual({
    ok: false,
    refusal: 'document doc_a holds no text',
  });
  expect(await callTool(fileSchemaSample, holding('a', 'b'), { document: 'doc_a' })).toStrictEqual({
    ok: false,
    refusal: 'document doc_a holds 2 pages, and a table is one',
  });
});

test('a header with a blank name or a name twice is refused', () => {
  expect(() => tableOf('a,,b\n1,2,3')).toThrow(ToolRefusal);
  expect(() => tableOf('a,a\n1,2')).toThrow(/twice/u);
});
