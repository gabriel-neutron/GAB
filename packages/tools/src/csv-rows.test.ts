import { expect, test } from 'vitest';

import { CsvFault } from './csv.ts';
import { csvRows } from './csv-rows.ts';

const read = (page: string) =>
  [...csvRows(page)].map((row) => ({
    text: page.slice(row.start, row.end),
    values: row.fields.map((field) => field.value),
    raw: row.fields.map((field) => page.slice(field.start, field.end)),
  }));

test('a quoted value keeps its comma, its doubled quote and its line break', () => {
  const page = 'a,"b, ""c""\nd",e\r\n\nf\n';
  expect(read(page)).toStrictEqual([
    {
      text: 'a,"b, ""c""\nd",e',
      values: ['a', 'b, "c"\nd', 'e'],
      raw: ['a', '"b, ""c""\nd"', 'e'],
    },
    { text: 'f', values: ['f'], raw: ['f'] },
  ]);
});

test('a page with no final line break gives its last row, and a byte order mark is skipped', () => {
  expect(read('﻿x,y\nz')).toStrictEqual([
    { text: 'x,y', values: ['x', 'y'], raw: ['x', 'y'] },
    { text: 'z', values: ['z'], raw: ['z'] },
  ]);
});

test('a quote that never closes is a fault', () => {
  expect(() => [...csvRows('a,"b\nc')]).toThrow(CsvFault);
});
