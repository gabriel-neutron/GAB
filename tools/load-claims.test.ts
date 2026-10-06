// The checks of the claims load that need no database: the reverse read of the source map, the
// flags of each block and the summary of the run report. Every file of the fixture is invented.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseClaims } from '@gab/worker/report-claims';
import { expect, test } from 'vitest';

import { rowsOfCsv } from './csv.ts';
import { claimIdsOf, parseLoadArguments, planClaims, summaryLines } from './load-claims.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures/claims');

const fixtureBlocks = async () => [
  ...parseClaims(await readFile(join(FIXTURES, 'alpha-final.md'), 'utf8'), 'alpha-final.md'),
  ...parseClaims(await readFile(join(FIXTURES, 'beta-final.md'), 'utf8'), 'beta-final.md'),
];

const fixtureMap = async () => rowsOfCsv(await readFile(join(FIXTURES, 'sources-map.csv'), 'utf8'));

test('the claim ids cell of a map row is split on commas, semicolons and spaces', () => {
  expect(claimIdsOf('C-A-1, C-A-2;C-B-1  C-B-2')).toStrictEqual([
    'C-A-1',
    'C-A-2',
    'C-B-1',
    'C-B-2',
  ]);
  expect(claimIdsOf('')).toStrictEqual([]);
});

test('each claim gets the document ids of the S-ids that name it, read in reverse', async () => {
  const plan = planClaims(await fixtureBlocks(), await fixtureMap());
  const of = (id: string) => plan.claims.find((claim) => claim.block.claimId === id);

  expect(of('C-ALPHA-1')).toMatchObject({
    documentIds: ['doc_a1a1a1a1a1a1', 'doc_b2b2b2b2b2b2'],
    unmapped: [],
    noSource: false,
  });
  expect(of('C-ALPHA-4')?.documentIds).toStrictEqual(['doc_a1a1a1a1a1a1']);
  expect(new TextDecoder().decode(of('C-ALPHA-1')?.bytes)).toContain(
    'Sources: doc_a1a1a1a1a1a1, doc_b2b2b2b2b2b2\n',
  );
});

test('an S-id with no document id is unmapped, and a claim that no S-id names has no source', async () => {
  const plan = planClaims(await fixtureBlocks(), await fixtureMap());
  const of = (id: string) => plan.claims.find((claim) => claim.block.claimId === id);

  expect(of('C-ALPHA-2')).toMatchObject({ documentIds: [], unmapped: ['S03'], noSource: false });
  expect(new TextDecoder().decode(of('C-ALPHA-2')?.bytes)).toContain('Sources: none\n');
  expect(of('C-BETA-1')).toMatchObject({ documentIds: [], unmapped: [], noSource: true });
});

test('a claim id of the map that no block has is an unknown claim', async () => {
  const plan = planClaims(await fixtureBlocks(), await fixtureMap());

  expect(plan.unknownClaims).toStrictEqual(['C-GAMMA-9']);
});

test('the same blocks and the same map always give the same bytes', async () => {
  const first = planClaims(await fixtureBlocks(), await fixtureMap());
  const second = planClaims(await fixtureBlocks(), [...(await fixtureMap())].reverse());

  expect(second.claims.map((claim) => claim.bytes)).toStrictEqual(
    first.claims.map((claim) => claim.bytes),
  );
});

test('two blocks with one claim id give two planned documents with other bytes', () => {
  const blocks = parseClaims(
    '### C-SHAPE-3\n**Énoncé** : one\n\n### C-SHAPE-3\n**Énoncé** : two\n',
    'x-final.md',
  );
  const plan = planClaims(blocks, []);

  expect(plan.claims).toHaveLength(2);
  expect(plan.claims[0]?.bytes).not.toStrictEqual(plan.claims[1]?.bytes);
});

test('a run with no retrieval day stops before it reads or writes anything', () => {
  expect(() => parseLoadArguments(['folder', '--map', 'sources-map.csv'])).toThrow(
    /--retrieved-at is required/,
  );
  expect(() =>
    parseLoadArguments(['folder', '--map', 'm.csv', '--retrieved-at', '2026-02-30']),
  ).toThrow(/not a real day/);
  expect(() => parseLoadArguments(['folder', '--retrieved-at', '2026-10-05'])).toThrow(/--map/);
  expect(parseLoadArguments(['folder', '--map', 'm.csv', '--retrieved-at', '2026-10-05'])).toEqual({
    folder: 'folder',
    map: 'm.csv',
    retrievedAt: '2026-10-05',
  });
});

test('the summary counts each status and names the unknown claims', () => {
  expect(
    summaryLines(
      [{ status: 'stored' }, { status: 'stored' }, { status: 'deleted' }, { status: 'changed' }],
      ['C-GAMMA-9'],
    ),
  ).toStrictEqual([
    'stored 2, known 0, deleted 1, changed 1, refused 0',
    'unknown claim  C-GAMMA-9',
  ]);
});
