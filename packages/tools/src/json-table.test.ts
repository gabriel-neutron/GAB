import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { fileSchemaSample } from './file-schema-sample.ts';
import { readJsonTable } from './json-table.ts';
import { tableFormatOf, tableOf } from './table.ts';
import { callTool, ToolRefusal, type Session } from './tool.ts';

const answer = readFileSync(join(import.meta.dirname, '../fixtures/comtrade-answer.json'), 'utf8');

test('a JSON media type is a JSON table', () => {
  expect(tableFormatOf('application/json; charset=utf-8')).toBe('json');
  expect(tableFormatOf('application/ld+json')).toBe('json');
});

test('an answer gives one row for each element of the data list, with the columns of the answer', () => {
  const { header, rows } = tableOf(answer, 'json');
  expect(rows).toHaveLength(3);
  expect(header).toStrictEqual([
    'typeCode',
    'freqCode',
    'period',
    'reporterCode',
    'reporterDesc',
    'flowCode',
    'partnerCode',
    'partnerDesc',
    'cmdCode',
    'qty',
    'qtyUnitCode',
    'qtyUnitAbbr',
    'primaryValue',
  ]);
  const column = (name: string): number => header.indexOf(name);
  expect(rows[0]?.fields[column('reporterCode')]).toBe('156');
  expect(rows[0]?.fields[column('cmdCode')]).toBe('2709');
  expect(rows[0]?.fields[column('primaryValue')]).toBe('52000000.5');
});

test('the span of a row is its element in the page', () => {
  const points = Array.from(answer);
  const { rows } = readJsonTable(answer);
  for (const row of rows) {
    const element = JSON.parse(points.slice(row.start, row.end).join('')) as Record<string, unknown>;
    expect(element.cmdCode).toBeTypeOf('string');
  }
  expect(JSON.parse(points.slice(rows[2]?.start, rows[2]?.end).join(''))).toMatchObject({
    cmdCode: '2701',
  });
});

test('a null and a missing key give an empty cell, and a number keeps the text of the source', () => {
  const { header, rows } = readJsonTable(answer);
  const qty = header.indexOf('qty');
  expect(rows[0]?.fields[qty]).toBe('1.10');
  expect(rows[1]?.fields[qty]).toBe('');
  expect(rows[2]?.fields[qty]).toBe('');
  expect(rows[1]?.fields[header.indexOf('primaryValue')]).toBe('0');
});

test('a span counts code points, not UTF-16 units', () => {
  const text = '{"data":[{"name":"Côte 🚢","v":1}]}';
  const [row] = readJsonTable(text).rows;
  expect(Array.from(text).slice(row?.start, row?.end).join('')).toBe('{"name":"Côte 🚢","v":1}');
});

test('a page that is no answer with a data list is refused with a sentence', () => {
  expect(() => readJsonTable('not json')).toThrow(ToolRefusal);
  expect(() => readJsonTable('{"data":[]}')).toThrow('holds no data list with a row');
  expect(() => readJsonTable('[1,2]')).toThrow('data list of objects');
  expect(() => readJsonTable('{"data":[1]}')).toThrow('data list of objects');
  expect(() => readJsonTable('{"data":[{"a":1,"a":2}]}')).toThrow('names a twice');
});

test('the sample of a stored JSON answer gives the header and the rows', async () => {
  const session: Session = {
    query: () =>
      Promise.resolve({
        rows: [{ extractor: 'set@1', page: 1, text: answer, mime: 'application/json' }],
      }),
  };
  const read = await callTool(fileSchemaSample, session, { document: 'doc_a' });
  expect(read).toMatchObject({ ok: true, output: { rowCount: 3 } });
});
