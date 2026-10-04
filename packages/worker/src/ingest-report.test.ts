import { expect, test } from 'vitest';

import { buildReport, summaryLines, titleStem } from './ingest-report.ts';
import type { IngestOutcome } from './ingest.ts';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const SHA_D = 'd'.repeat(64);

const stored = (
  path: string,
  sha256: string,
  pageCount: number,
  emptyPages: readonly number[],
): IngestOutcome => ({
  path,
  status: 'stored',
  id: `doc_${sha256.slice(0, 12)}`,
  sha256,
  pageCount,
  emptyPages,
});
const known = (path: string, sha256: string): IngestOutcome => ({
  path,
  status: 'known',
  id: `doc_${sha256.slice(0, 12)}`,
  sha256,
});

test.each([
  ['energy.pdf', 'energy'],
  ['energy (1).pdf', 'energy'],
  ['Energy (12).PDF', 'energy'],
  ['building-capitalism.pdf', 'building-capitalism'],
  ['building-capitalism_compressed.pdf', 'building-capitalism'],
  ['building-capitalism - compressed.pdf', 'building-capitalism'],
  ['a  b.pdf', 'a b'],
  ['inner/energy (1).pdf', 'energy'],
  ['archive.v2.pdf', 'archive.v2'],
])('the title stem of %s is %s', (path, stem) => {
  expect(titleStem(path)).toBe(stem);
});

test('the counts follow the status of each file', () => {
  const report = buildReport(
    [
      stored('a.pdf', SHA_A, 1, []),
      known('b.pdf', SHA_A),
      { path: 'c.xyz', status: 'refused', reason: 'no type is read from it' },
    ],
    false,
  );
  expect(report.counts).toStrictEqual({ stored: 1, known: 1, refused: 1 });
  expect(report.dryRun).toBe(false);
  expect(report.refused).toStrictEqual([{ path: 'c.xyz', reason: 'no type is read from it' }]);
});

test('a PDF with an empty page on every page has no text layer', () => {
  const report = buildReport([stored('scan.pdf', SHA_A, 2, [1, 2])], false);
  expect(report.noTextLayer).toStrictEqual([
    { path: 'scan.pdf', id: 'doc_aaaaaaaaaaaa', pageCount: 2 },
  ]);
  expect(report.partialText).toStrictEqual([]);
});

test('a PDF of zero pages has no text layer, and emptyPages alone cannot tell it', () => {
  const report = buildReport([stored('void.pdf', SHA_A, 0, [])], false);
  expect(report.noTextLayer.map((entry) => entry.path)).toStrictEqual(['void.pdf']);
});

test('a PDF with some empty pages is named with its page numbers', () => {
  const report = buildReport([stored('half.pdf', SHA_A, 4, [2, 4])], false);
  expect(report.noTextLayer).toStrictEqual([]);
  expect(report.partialText).toStrictEqual([
    { path: 'half.pdf', id: 'doc_aaaaaaaaaaaa', pageCount: 4, emptyPages: [2, 4] },
  ]);
});

test('a PDF with text on every page, a known PDF and a text file are not named', () => {
  const report = buildReport(
    [stored('full.pdf', SHA_A, 2, []), known('old.pdf', SHA_B), stored('empty.txt', SHA_C, 1, [1])],
    false,
  );
  expect(report.noTextLayer).toStrictEqual([]);
  expect(report.partialText).toStrictEqual([]);
});

test('two files with the same stem and different bytes are a pair, and they stay two documents', () => {
  const report = buildReport(
    [
      stored('d/energy.pdf', SHA_A, 1, []),
      stored('d/energy (1).pdf', SHA_B, 1, []),
      stored('d/other.pdf', SHA_C, 1, []),
    ],
    false,
  );
  expect(report.nearCopies).toStrictEqual([
    {
      stem: 'energy',
      files: [
        { path: 'd/energy.pdf', id: 'doc_aaaaaaaaaaaa', sha256: SHA_A },
        { path: 'd/energy (1).pdf', id: 'doc_bbbbbbbbbbbb', sha256: SHA_B },
      ],
    },
  ]);
});

test('a copy with the same bytes makes no pair, and a known file joins a pair', () => {
  const same = buildReport([stored('x.pdf', SHA_A, 1, []), known('x (1).pdf', SHA_A)], false);
  expect(same.nearCopies).toStrictEqual([]);
  const joined = buildReport(
    [known('x.pdf', SHA_A), stored('x_compressed.pdf', SHA_B, 1, [])],
    false,
  );
  expect(joined.nearCopies).toHaveLength(1);
});

test('files with one stem and two extensions make no pair', () => {
  const report = buildReport(
    [stored('x.pdf', SHA_A, 1, []), stored('x.html', SHA_B, 1, [])],
    false,
  );
  expect(report.nearCopies).toStrictEqual([]);
});

test('the summary of a real run says stored', () => {
  const report = buildReport([stored('a.pdf', SHA_A, 1, []), known('b.pdf', SHA_A)], false);
  const text = summaryLines(report).join('\n');
  expect(text).toContain('stored 1');
  expect(text).toContain('known 1');
  expect(text).not.toContain('would store');
});

test('the summary of a dry run says would store, and it says nothing was written', () => {
  const report = buildReport([stored('a.pdf', SHA_A, 1, [])], true);
  expect(report.dryRun).toBe(true);
  expect(report.counts.stored).toBe(1);
  const text = summaryLines(report).join('\n');
  expect(text).toContain('would store 1');
  expect(text).toContain('nothing was written');
});

test('the summary names the PDFs with no text, the PDFs with some, and the pairs', () => {
  const report = buildReport(
    [
      stored('scan.pdf', SHA_A, 2, [1, 2]),
      stored('half.pdf', SHA_B, 4, [2, 4]),
      stored('p.pdf', SHA_C, 1, []),
      stored('p (1).pdf', SHA_D, 1, []),
    ],
    false,
  );
  const text = summaryLines(report).join('\n');
  expect(text).toContain('scan.pdf');
  expect(text).toMatch(/half\.pdf.*pages 2, 4/);
  expect(text).toMatch(/p\.pdf/);
  expect(text).toMatch(/p \(1\)\.pdf/);
});
