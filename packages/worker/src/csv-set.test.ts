import { bytesSource } from '@gab/text/zip';
import { expect, test } from 'vitest';

import { csvSetName, MAX_CSV_BYTES, headlessCsv, tagsOf } from './csv-set.ts';
import type { Queryable } from './queryable.ts';
import { makeTextSet } from './text-set.ts';

// A sample in the shape of the SDN list of OFAC. It is a fixture and holds no row of a real file.
const COLUMNS = ['ent_num', 'name', 'type', 'program', 'vessel_type'];
const FILE = [
  '1,"ALPHA, ONE",vessel,RUSSIA-EO14024,Crude Oil Tanker',
  '2,BETA,vessel,UKRAINE-EO13662] [RUSSIA-EO14024,General Cargo',
  '3,GAMMA,vessel,IRAN-EO13902,Crude Oil Tanker',
  '4,DELTA,vessel,RUSSIA-EO14024-LATER,Tug',
  '5,EPSILON,vessel,"CAATSA - RUSSIA] [RUSSIA-EO14024] [PEESA-EO14039",Ro-Ro',
  '6,ZETA,vessel',
].join('\r\n');
const source = () => bytesSource(new TextEncoder().encode(FILE));
const TAG = { column: 'program', value: 'RUSSIA-EO14024' };

test('a cell gives its whole tags', () => {
  expect(tagsOf('A] [B')).toStrictEqual(['A', 'B']);
  expect(tagsOf('[A]')).toStrictEqual(['A']);
  expect(tagsOf('CAATSA - RUSSIA] [X')).toStrictEqual(['CAATSA - RUSSIA', 'X']);
  expect(tagsOf('')).toStrictEqual([]);
});

test('the filter keeps one tag, alone or with others, in file order, and not a longer tag', async () => {
  const text = await headlessCsv(source(), COLUMNS, TAG);
  expect(text).toBe(
    [
      'ent_num,name,type,program,vessel_type',
      '1,"ALPHA, ONE",vessel,RUSSIA-EO14024,Crude Oil Tanker',
      '2,BETA,vessel,UKRAINE-EO13662] [RUSSIA-EO14024,General Cargo',
      '5,EPSILON,vessel,CAATSA - RUSSIA] [RUSSIA-EO14024] [PEESA-EO14039,Ro-Ro',
      '',
    ].join('\r\n'),
  );
  expect(await headlessCsv(source(), COLUMNS, TAG)).toBe(text);
});

test('with no tag every row is kept, and a short row is padded', async () => {
  const text = await headlessCsv(source(), COLUMNS);
  expect(text.split('\r\n')).toHaveLength(8);
  expect(text).toContain('6,ZETA,vessel,,\r\n');
});

test('a bad request is refused', async () => {
  await expect(headlessCsv(source(), COLUMNS, { column: 'nope', value: 'X' })).rejects.toThrow(
    'no column "nope"',
  );
  await expect(headlessCsv(source(), ['a', 'a'])).rejects.toThrow('must differ');
  await expect(headlessCsv(source(), ['a,b', 'c'])).rejects.toThrow('holds no comma');
  await expect(
    headlessCsv(source(), COLUMNS, { column: 'program', value: 'A] [B' }),
  ).rejects.toThrow('no bracket');
  await expect(headlessCsv(source(), COLUMNS, { column: 'program', value: ' ' })).rejects.toThrow(
    'not empty',
  );
  const big = { size: MAX_CSV_BYTES + 1, read: () => Promise.resolve(new Uint8Array()) };
  await expect(headlessCsv(big, COLUMNS)).rejects.toThrow('larger than');
  await expect(headlessCsv(source(), [])).rejects.toThrow('name to each column');
});

test('the name holds the columns and the tag', () => {
  expect(csvSetName(COLUMNS, TAG)).toBe(
    'xlsx-1|csv=ent_num,name,type,program,vessel_type|tag=program=RUSSIA-EO14024',
  );
});

test('a CSV set is stored once, and the same request is known after', async () => {
  const puts: unknown[][] = [];
  let held: string | undefined;
  const db: Queryable = {
    query: (sql, params) => {
      if (sql.includes('s3_key'))
        return Promise.resolve({ rows: [{ s3_key: 'k', mime: 'text/csv; charset=utf-8' }] });
      if (sql.includes('FROM public.document_text'))
        return Promise.resolve({ rows: held === undefined ? [] : [{ text: held }] });
      puts.push([...(params ?? [])]);
      held = (JSON.parse(String(params?.[1])) as string[])[0];
      return Promise.resolve({ rows: [] });
    },
  };
  const deps = { db, open: () => Promise.resolve(source()) };
  const request = { document: 'doc_x', columns: COLUMNS, tag: TAG };
  const name = csvSetName(COLUMNS, TAG);
  expect(await makeTextSet(deps, request)).toStrictEqual({ name, status: 'stored', rows: 3 });
  expect(await makeTextSet(deps, request)).toStrictEqual({ name, status: 'known', rows: 3 });
  expect(puts).toHaveLength(1);
});

test('a document that is no CSV is refused', async () => {
  const db = {
    query: () => Promise.resolve({ rows: [{ s3_key: 'k', mime: 'application/zip' }] }),
  } as unknown as Queryable;
  await expect(
    makeTextSet({ db, open: () => Promise.resolve(source()) }, { document: 'd', columns: COLUMNS }),
  ).rejects.toThrow('is no CSV file');
});
