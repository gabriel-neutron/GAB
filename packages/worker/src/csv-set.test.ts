import { MAX_TABLE_CHARS } from '@gab/text/xlsx';
import { readCsv } from '@gab/tools/csv';
import { bytesSource } from '@gab/text/zip';
import { expect, test } from 'vitest';

import { csvRecords, csvSetName, MAX_CSV_BYTES, headlessCsv, tagsOf } from './csv-set.ts';
import type { Queryable } from './queryable.ts';
import { requestOf } from './text-set-command.ts';
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

test('the exact-value filter and the tag must both hold', async () => {
  const mixed = bytesSource(
    new TextEncoder().encode(
      [
        '1,ALPHA,vessel,RUSSIA-EO14024,Tanker',
        '2,BETA CORP,entity,RUSSIA-EO14024,',
        '3,GAMMA,vessel,IRAN-EO13902,Tanker',
        '4,DELTA,vessel,UKRAINE-EO13662] [RUSSIA-EO14024,Tug',
        '5,EPSILON,vessel ,RUSSIA-EO14024,Tug',
        '6,ZETA,vessels,RUSSIA-EO14024,Tug',
      ].join('\n'),
    ),
  );
  const text = await headlessCsv(mixed, COLUMNS, TAG, [{ column: 'type', value: 'vessel' }]);
  expect(text.split('\r\n').map((line) => line.split(',')[0])).toStrictEqual([
    'ent_num',
    '1',
    '4',
    '5',
    '',
  ]);
  // The filter alone keeps the vessels of every tag, in file order.
  const alone = await headlessCsv(mixed, COLUMNS, undefined, [{ column: 'type', value: 'vessel' }]);
  expect(alone.split('\r\n').map((line) => line.split(',')[0])).toStrictEqual([
    'ent_num',
    '1',
    '3',
    '4',
    '5',
    '',
  ]);
  // Two filters on two columns must both hold.
  const two = await headlessCsv(mixed, COLUMNS, undefined, [
    { column: 'vessel_type', value: 'Tug' },
    { column: 'type', value: 'vessel' },
  ]);
  expect(two.split('\r\n').map((line) => line.split(',')[0])).toStrictEqual([
    'ent_num',
    '4',
    '5',
    '',
  ]);
});

test('a bad exact-value filter is refused', async () => {
  const eq = (column: string, value: string) => ({ column, value });
  await expect(headlessCsv(source(), COLUMNS, undefined, [eq('nope', 'x')])).rejects.toThrow(
    'no column "nope"',
  );
  await expect(headlessCsv(source(), COLUMNS, undefined, [eq('type', ' ')])).rejects.toThrow(
    'not empty',
  );
  await expect(headlessCsv(source(), COLUMNS, undefined, [eq('type', 'a|b')])).rejects.toThrow(
    'no bar',
  );
  await expect(
    headlessCsv(source(), COLUMNS, undefined, [eq('type', 'a'), eq('type', 'b')]),
  ).rejects.toThrow('more than one filter');
  await expect(headlessCsv(source(), COLUMNS, TAG, [eq('program', 'x')])).rejects.toThrow(
    'more than one filter',
  );
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
  await expect(
    headlessCsv(bytesSource(new TextEncoder().encode('1,"open\n')), ['a', 'b']),
  ).rejects.toThrow('never closes');
  await expect(headlessCsv(big, COLUMNS)).rejects.toThrow('larger than');
  await expect(headlessCsv(source(), [])).rejects.toThrow('name to each column');
});

test('the name holds the columns and the tag', () => {
  expect(csvSetName(COLUMNS, TAG)).toBe(
    'xlsx-1|csv=ent_num,name,type,program,vessel_type|tag=program=RUSSIA-EO14024',
  );
});

test('the name sorts the exact-value filters and trims their values', () => {
  expect(csvSetName(['a'], undefined, [{ column: 'a', value: ' x ' }])).toBe(
    csvSetName(['a'], undefined, [{ column: 'a', value: 'x' }]),
  );
  const a = { column: 'type', value: 'vessel' };
  const b = { column: 'flag', value: 'Russia' };
  expect(csvSetName(['type', 'flag'], TAG, [a, b])).toBe(csvSetName(['type', 'flag'], TAG, [b, a]));
  expect(csvSetName(['type', 'flag'], TAG, [a])).toBe(
    'xlsx-1|csv=type,flag|tag=program=RUSSIA-EO14024|equals=type=vessel',
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

test('the command reads a repeated --equals, and refuses a bad one', () => {
  expect(
    requestOf(['doc_x', '--columns', 'a,b', '--tag', 'b=T', '--equals', 'a=1', '--equals', 'b=2']),
  ).toStrictEqual({
    document: 'doc_x',
    columns: ['a', 'b'],
    tag: { column: 'b', value: 'T' },
    equals: [
      { column: 'a', value: '1' },
      { column: 'b', value: '2' },
    ],
  });
  expect(() => requestOf(['doc_x', '--columns', 'a', '--equals', 'a'])).toThrow('--equals is');
  expect(() => requestOf(['doc_x', '--sheet', 's', '--equals', 'a=1'])).toThrow(
    'go with --columns',
  );
});

test('a file larger than one chunk is read as a stream, with a preamble and a header line', async () => {
  const names = ['Unique ID', 'Name', 'Designation Type', 'Note'];
  const lines = ['Report Date,16/10/2026', names.join(',')];
  // About 24 MiB: more than the old cap, and many chunks, with quoted fields that hold line breaks.
  for (let index = 0; index < 120_000; index += 1) {
    const type = index % 4000 === 0 ? 'Ship' : 'Individual';
    lines.push(
      `${String(index)},"Name, é ${String(index)}",${type},"line 1\r\nline 2 ""q"" ${'x'.repeat(180)}"`,
    );
  }
  const file = bytesSource(new TextEncoder().encode(`\uFEFF${lines.join('\r\n')}\r\n`));
  expect(file.size).toBeGreaterThan(16 * 1024 * 1024);
  const tag = { column: 'type', value: 'Ship' };
  const text = await headlessCsv(file, ['id', 'name', 'type', 'note'], tag);
  const rows = readCsv(text);
  expect(rows).toHaveLength(31);
  expect(rows[1]?.fields[0]).toBe('0');
  expect(rows[1]?.fields[1]).toBe('Name, é 0');
  expect(rows[1]?.fields[3]).toContain('line 1\r\nline 2 "q" xxx');
  expect(rows.at(-1)?.fields[0]).toBe('116000');
  expect(text.length).toBeLessThan(MAX_TABLE_CHARS);
});

test('the stream reader gives the records of readCsv at every small chunk size', async () => {
  const body = '\uFEFF\r\n\r\n"a""b",c\n,"",\r"x\ny"\r\n\n"é""",ü,日本\r\n\n"""",""""""\r\n1,2';
  const expected = readCsv(body).map((record) => record.fields);
  const bytes = new TextEncoder().encode(body);
  for (let size = 1; size <= 9; size += 1) {
    const got: string[][] = [];
    for await (const fields of csvRecords(bytesSource(bytes), size)) got.push(fields);
    expect(got, `chunk size ${String(size)}`).toStrictEqual(expected);
  }
});

test('a record or a field past its cap is refused', async () => {
  const read = async (text: string) => {
    for await (const fields of csvRecords(bytesSource(new TextEncoder().encode(text)))) void fields;
  };
  await expect(read(','.repeat(10_001))).rejects.toThrow('holds more than 10000 fields');
  await expect(read(`"${'""'.repeat(1_100_000)}"`)).rejects.toThrow('characters');
  await expect(read(`a\n"${'x'.repeat(2_000_000)}`)).rejects.toThrow('record 2');
});

test('a column is cut from another column by a pattern', async () => {
  const file = bytesSource(
    new TextEncoder().encode(
      [
        '1,ALPHA,vessel,RUSSIA-EO14024,"Vessel Registration Identification IMO 9162928; MMSI 1"',
        '2,BETA,vessel,RUSSIA-EO14024,"Other text, then IMO 1234567 and IMO 7654321"',
        '3,GAMMA,vessel,RUSSIA-EO14024,"Vessel with no number; IMO 12"',
        '4,DELTA,entity,RUSSIA-EO14024,"IMO 9999999"',
        '5,EPSILON,vessel,IRAN-EO13902,"IMO 8888888"',
      ].join('\n'),
    ),
  );
  const imo = { name: 'imo', from: 'remarks', pattern: 'IMO (\\d{7})' };
  const columns = ['ent_num', 'name', 'type', 'program', 'remarks'];
  const text = await headlessCsv(file, columns, TAG, [{ column: 'type', value: 'vessel' }], [imo]);
  expect(readCsv(text).map((record) => [record.fields[0], record.fields[5]])).toStrictEqual([
    ['ent_num', 'imo'],
    ['1', '9162928'],
    ['2', '1234567'],
    ['3', ''],
  ]);
  // A filter may name the new column, and the same request gives the same text.
  const only = await headlessCsv(
    file,
    columns,
    undefined,
    [{ column: 'imo', value: '9999999' }],
    [imo],
  );
  expect(readCsv(only).map((record) => record.fields[0])).toStrictEqual(['ent_num', '4']);
  expect(await headlessCsv(file, columns, TAG, [{ column: 'type', value: 'vessel' }], [imo])).toBe(
    text,
  );
});

test('a bad extraction is refused', async () => {
  const columns = ['a', 'b'];
  const run = (one: { name: string; from: string; pattern: string }) =>
    headlessCsv(source(), columns, undefined, [], [one]);
  const good = { name: 'c', from: 'b', pattern: '(\\d+)' };
  await expect(run({ ...good, pattern: '\\d+' })).rejects.toThrow('exactly one capture group');
  await expect(run({ ...good, pattern: '(\\d)(\\d)' })).rejects.toThrow('exactly one');
  await expect(run({ ...good, pattern: '(\\d' })).rejects.toThrow('not a valid pattern');
  await expect(run({ ...good, from: 'zz' })).rejects.toThrow('no column "zz"');
  await expect(run({ ...good, name: ' ' })).rejects.toThrow('give a name');
  await expect(run({ ...good, name: 'a' })).rejects.toThrow('clashes');
  await expect(
    headlessCsv(source(), columns, undefined, [], [good, { ...good, from: 'a' }]),
  ).rejects.toThrow('clashes');
});

test('the name holds the extractions, and the command reads --extract', () => {
  const one = { name: 'imo', from: 'remarks', pattern: 'IMO (\\d{7}|x)' };
  expect(csvSetName(['remarks'], undefined, [], [one])).toBe(
    'xlsx-1|csv=remarks|extract=imo:remarks:"IMO (\\\\d{7}|x)"',
  );
  expect(
    requestOf(['doc_x', '--columns', 'a,remarks', '--extract', 'imo=remarks:IMO (\\d{7})']),
  ).toStrictEqual({
    document: 'doc_x',
    columns: ['a', 'remarks'],
    extract: [{ name: 'imo', from: 'remarks', pattern: 'IMO (\\d{7})' }],
  });
  expect(() => requestOf(['doc_x', '--columns', 'a', '--extract', 'imo=remarks'])).toThrow(
    '--extract is',
  );
  expect(() => requestOf(['doc_x', '--sheet', 's', '--extract', 'a=b:(c)'])).toThrow(
    'go with --columns',
  );
});
