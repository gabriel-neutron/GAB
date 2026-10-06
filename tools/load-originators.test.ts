// The checks of the originator load that need no database: the proposed map, the validation of
// the rows against the checked map, and the rules that refuse a row before any door is called.

import { expect, test } from 'vitest';

import { csvOfRows, rowsOfCsv } from './csv.ts';
import {
  checkedMapName,
  documentIdOfAddress,
  insideFolder,
  planRows,
  proposeMap,
  sourcesMapRows,
} from './load-originators.ts';

const source = (id: string, fields: Record<string, string> = {}): Record<string, string> => ({
  id,
  title: `Title of ${id}`,
  url: '',
  admiralty: 'A',
  date_consultation: '',
  ...fields,
});

const entry = (id: string, canonical: string, fields: Record<string, string> = {}) => ({
  id,
  canonical_id: canonical,
  kind: 'organisation',
  path: '',
  match_reason: '',
  ...fields,
});

test('a csv written by the loader reads back as the same rows', () => {
  const text = csvOfRows(
    ['id', 'note'],
    [
      ['S1', 'a;b'],
      ['S2', 'say "x"\nthen go'],
    ],
  );
  expect(rowsOfCsv(text)).toStrictEqual([
    { id: 'S1', note: 'a;b' },
    { id: 'S2', note: 'say "x"\nthen go' },
  ]);
});

test('the proposer reads an issuer host, an author on a carrier and a state body', () => {
  const rows = [
    source('S1', { url: 'https://www.agency.example/report.pdf' }),
    source('S2', { url: 'https://writer.substack.com/p/post' }),
    source('S3', { url: 'https://stat.gov.xx/table' }),
    source('S4', { url: 'https://example.livejournal.com/123.html' }),
  ];
  const proposed = proposeMap(rows, []);
  expect(proposed.map((row) => [row.canonical_id, row.kind])).toStrictEqual([
    ['host:agency.example', 'organisation'],
    ['substack:writer', 'account'],
    ['host:stat.gov.xx', 'state_body'],
    ['livejournal:example', 'account'],
  ]);
});

test('the proposer never guesses a platform account id, a carrier or a missing address', () => {
  const rows = [
    source('S1', { url: 'https://t.me/some_channel/12' }),
    source('S2', { url: 'https://x.com/someone/status/1' }),
    source('S3', { url: 'https://substack.com/home' }),
    source('S4'),
  ];
  const proposed = proposeMap(rows, []);
  expect(proposed.map((row) => row.canonical_id)).toStrictEqual(['', '', '', '']);
  for (const row of proposed) expect(row.match_reason).not.toBe('');
});

test('the proposer matches a file by the last segment of the address, by the id and by the title', () => {
  const rows = [
    source('S1', { url: 'https://agency.example/files/annual%20report.pdf' }),
    source('S2', { title: 'Order of the ministry' }),
    source('S3', { title: 'Something else' }),
    source('S4', { url: 'https://agency.example/twin.pdf' }),
  ];
  const files = [
    'a/annual report.pdf',
    'b/S2 - order.pdf',
    'c/order of the ministry.html',
    'd/twin.pdf',
    'e/twin.pdf',
  ];
  const proposed = proposeMap(rows, files);
  expect(proposed.map((row) => row.path)).toStrictEqual([
    'a/annual report.pdf',
    'b/S2 - order.pdf',
    '',
    '',
  ]);
  expect(proposed[1]?.match_reason).toContain('starts with the id');
  expect(proposed[3]?.match_reason).toContain('2 files');
});

test('a file that the operator did not rename is refused as the checked map', () => {
  expect(() => checkedMapName('/out/originators.proposed.csv')).toThrow(/proposed/);
  expect(() => checkedMapName('/out/originators.csv')).not.toThrow();
});

test('a folder is inside another folder only when its path starts under it', () => {
  expect(insideFolder('/repo/out', '/repo')).toBe(true);
  expect(insideFolder('/repo', '/repo')).toBe(true);
  expect(insideFolder('/repository', '/repo')).toBe(false);
  expect(insideFolder('/elsewhere/out', '/repo')).toBe(false);
});

test('the id of a document with no bytes comes from its address, or from its title', () => {
  const byAddress = documentIdOfAddress('https://agency.example/a', 'Title');
  expect(byAddress).toMatch(/^doc_[0-9a-f]{12}$/);
  expect(documentIdOfAddress('https://agency.example/a', 'Other title')).toBe(byAddress);
  expect(documentIdOfAddress('', 'Title')).not.toBe(byAddress);
  expect(documentIdOfAddress('', 'Title')).toBe(documentIdOfAddress('', 'Title'));
});

test('a bad letter, a missing canonical id and a scheme outside the list refuse the row', () => {
  const plan = planRows(
    [
      source('S1'),
      source('S2', { admiralty: 'Z' }),
      source('S3', { admiralty: 'B2' }),
      source('S4'),
      source('S5'),
      source('S6'),
      source('S7'),
    ],
    [
      entry('S1', 'host:good.example'),
      entry('S2', 'host:bad-letter.example'),
      entry('S3', 'host:digit.example'),
      entry('S4', ''),
      entry('S5', 'ftp:nothing'),
      entry('S6', 'Some Agency'),
      entry('S7', 'host:other.example', { kind: 'own_algorithm' }),
    ],
  );
  expect(plan.accepted.map((row) => row.id)).toStrictEqual(['S1']);
  const wanted: Record<string, RegExp> = {
    S2: /letter/,
    S3: /letter/,
    S4: /canonical id/,
    S5: /scheme/,
    S6: /canonical id/,
    S7: /kind/,
  };
  expect(plan.refused.map((row) => row.id)).toStrictEqual(Object.keys(wanted));
  for (const row of plan.refused) expect(row.detail).toMatch(wanted[row.id] ?? /never/);
});

test('a row that the map does not name is refused, and a name is never a key', () => {
  const plan = planRows([source('S1', { title: 'host:named.example' })], []);
  expect(plan.accepted).toStrictEqual([]);
  expect(plan.refused[0]?.detail).toContain('map');
});

test('two rows with one canonical id and two letters are both refused and reported', () => {
  const plan = planRows(
    [source('S1', { admiralty: 'A' }), source('S2', { admiralty: 'B' }), source('S3')],
    [
      entry('S1', 'host:same.example'),
      entry('S2', 'host:same.example'),
      entry('S3', 'host:same.example'),
    ],
  );
  expect(plan.accepted).toStrictEqual([]);
  expect(plan.refused.map((row) => row.id)).toStrictEqual(['S1', 'S2', 'S3']);
  for (const row of plan.refused) expect(row.detail).toContain('one letter');
});

test('two rows with one canonical id and one letter are accepted together', () => {
  const plan = planRows(
    [source('S1'), source('S2')],
    [entry('S1', 'host:same.example'), entry('S2', 'host:same.example')],
  );
  expect(plan.accepted.map((row) => row.id)).toStrictEqual(['S1', 'S2']);
});

test('the source map has one row for each S-id of the report, a refused row too, with its claim ids', () => {
  const sources = [
    source('S1', { claims_ids: 'C-A-1, C-A-2' }),
    source('S2', { claims_ids: 'C-B-1' }),
    source('S3', { claims_ids: 'C-C-1' }),
    source('', { claims_ids: 'C-D-1' }),
  ];
  const rows = sourcesMapRows(
    {
      licence: '',
      rows: [
        {
          id: 'S1',
          canonicalId: 'host:one.example',
          status: 'loaded',
          detail: '',
          documentId: 'doc_aaaaaaaaaaaa',
        },
        { id: 'S2', status: 'refused', detail: 'the checked map holds no canonical id' },
        { id: 'S3', canonicalId: 'host:three.example', status: 'partial', detail: '' },
        { id: 'row 5', status: 'refused', detail: 'the id of the row is blank' },
      ],
    },
    sources,
  );
  expect(rows).toStrictEqual([
    ['S1', 'host:one.example', 'doc_aaaaaaaaaaaa', 'C-A-1, C-A-2'],
    ['S2', '', '', 'C-B-1'],
    ['S3', 'host:three.example', '', 'C-C-1'],
  ]);
});

test('an S-id on two rows gives one map row, with the claim ids of both rows', () => {
  const sources = [
    source('S1', { claims_ids: 'C-A-1' }),
    source('S1', { claims_ids: 'C-A-2' }),
    source('S2'),
  ];
  const rows = sourcesMapRows(
    {
      licence: '',
      rows: [
        { id: 'S1', status: 'refused', detail: 'the id appears on more than one row' },
        { id: 'S1', status: 'refused', detail: 'the id appears on more than one row' },
        { id: 'S2', status: 'refused', detail: 'the checked map has no row for this id' },
      ],
    },
    sources,
  );
  expect(rows).toStrictEqual([
    ['S1', '', '', 'C-A-1, C-A-2'],
    ['S2', '', '', ''],
  ]);
});
