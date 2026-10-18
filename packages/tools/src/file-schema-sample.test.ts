import { expect, test } from 'vitest';
import type { z } from 'zod';

import { headerSignature } from './header-signature.ts';
import { fileSchemaSample } from './file-schema-sample.ts';
import { callTool, ToolRefusal, type Session, type ToolOutcome } from './tool.ts';
import { tableOf } from './table.ts';

const page = (rows: number): string =>
  [
    'Name,IMO,Built',
    ...Array.from({ length: rows }, (_, i) => `Hull ${String(i + 1)},${String(9100000 + i)},2001`),
  ].join('\n');

// A session that holds pages of text of one media type, whatever the query asks.
const holdingOf = (mime: string, ...pages: string[]): Session => ({
  query: () =>
    Promise.resolve({
      rows: pages.map((text, index) => ({ extractor: 'set@1', page: index + 1, text, mime })),
    }),
});

const holding = (...pages: string[]): Session => holdingOf('text/csv', ...pages);

// The output of a call that the test expects to succeed, read through the output schema.
const sampleOf = (outcome: ToolOutcome): z.output<typeof fileSchemaSample.output> => {
  if (!outcome.ok) throw new Error(outcome.refusal);
  return fileSchemaSample.output.parse(outcome.output);
};

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
  const rows = sampleOf(read).rows;
  expect(rows).toHaveLength(20);
  expect(rows[0]).toStrictEqual({ row: 1, values: ['Hull 1', '9100000', '2001'] });
  expect(rows[19]?.row).toBe(20);
});

test('a table of fewer than twenty rows gives every row, and a long cell is cut', async () => {
  const long = 'x'.repeat(500);
  const read = await callTool(fileSchemaSample, holding(`a,b\n1,${long}\n2,3`), {
    document: 'doc_a',
  });
  const rows = sampleOf(read).rows;
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
  expect(() => tableOf('a,,b\n1,2,3', 'csv')).toThrow(ToolRefusal);
  expect(() => tableOf('a,a\n1,2', 'csv')).toThrow(/twice/u);
  expect(() => tableOf('a\ta\n1\t2', 'tsv')).toThrow(/twice/u);
});

// A Comext query, as Eurostat gives it in SDMX-CSV, and the same rows cut by tabs.
const SDMX_CSV =
  'DATAFLOW,freq,reporter,partner,TIME_PERIOD,OBS_VALUE\n' +
  'ESTAT:DS-045409(1.0),M,HU,RU,2026-07,3272070.00\n' +
  'ESTAT:DS-045409(1.0),M,SK,RU,2026-07,4003080.00\n';
const SAME_TSV = SDMX_CSV.replaceAll(',', '\t');

test('a TSV table and an SDMX-CSV table give the same sample as the same rows in a CSV', async () => {
  const csv = sampleOf(await callTool(fileSchemaSample, holding(SDMX_CSV), { document: 'doc_a' }));
  for (const [mime, text] of [
    ['text/tab-separated-values', SAME_TSV],
    ['application/vnd.sdmx.data+csv; version=1.0.0', SDMX_CSV],
  ] as const) {
    const read = await callTool(fileSchemaSample, holdingOf(mime, text), { document: 'doc_a' });
    expect(sampleOf(read)).toStrictEqual(csv);
  }
  expect(csv.header).toStrictEqual([
    'DATAFLOW',
    'freq',
    'reporter',
    'partner',
    'TIME_PERIOD',
    'OBS_VALUE',
  ]);
  expect(csv.rowCount).toBe(2);
});
