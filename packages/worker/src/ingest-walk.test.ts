import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, expect, test } from 'vitest';

import { expandPaths, matchesInclude, walkFolder } from './ingest-walk.ts';

// Departure: the folder holds the files of every case, and the suite removes it at the end.
let folder = '';
const at = (...parts: string[]): string => join(folder, ...parts);

beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'ingest-walk-suite-'));
  await mkdir(at('inner', '__pycache__'), { recursive: true });
  await mkdir(at('inner', 'deep'));
  for (const name of [
    'a.pdf',
    'B.PDF',
    'notes.txt',
    'run.py',
    'trace.out',
    join('inner', 'c.pdf'),
    join('inner', 'e.html'),
    join('inner', 'deep', 'd.pdf'),
    join('inner', 'deep', 'helper.py'),
    join('inner', '__pycache__', 'x.pdf'),
  ])
    await writeFile(at(name), 'x');
});
afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

test('a glob with no slash matches the base name at any depth', () => {
  expect(matchesInclude('a.pdf', '*.pdf')).toBe(true);
  expect(matchesInclude('inner/deep/a.pdf', '*.pdf')).toBe(true);
  expect(matchesInclude('inner/deep/a.pdfx', '*.pdf')).toBe(false);
  expect(matchesInclude('inner/deep/pdf', '*.pdf')).toBe(false);
});

test('a glob with a slash matches the path from the folder', () => {
  expect(matchesInclude('inner/c.pdf', 'inner/*.pdf')).toBe(true);
  expect(matchesInclude('inner/deep/d.pdf', 'inner/*.pdf')).toBe(false);
  expect(matchesInclude('inner/deep/d.pdf', 'inner/**/*.pdf')).toBe(true);
});

test('the extension is matched without regard to case', () => {
  expect(matchesInclude('B.PDF', '*.pdf')).toBe(true);
  expect(matchesInclude('b.pdf', '*.PDF')).toBe(true);
  expect(matchesInclude('Report.Pdf', '*.pdf')).toBe(true);
});

test('a folder gives its own PDFs in sorted order, and the default glob takes PDFs only', async () => {
  expect(await walkFolder(folder, { recursive: false, include: ['*.pdf'] })).toStrictEqual([
    at('B.PDF'),
    at('a.pdf'),
  ]);
});

test('a recursive walk goes down, and it never takes a script, an .out file or __pycache__', async () => {
  expect(await walkFolder(folder, { recursive: true, include: ['*'] })).toStrictEqual([
    at('B.PDF'),
    at('a.pdf'),
    at('inner', 'c.pdf'),
    at('inner', 'deep', 'd.pdf'),
    at('inner', 'e.html'),
    at('notes.txt'),
  ]);
});

test('a type is taken only when the operator names it', async () => {
  expect(await walkFolder(folder, { recursive: true, include: ['*.html', '*.txt'] })).toStrictEqual(
    [at('inner', 'e.html'), at('notes.txt')],
  );
  expect(await walkFolder(folder, { recursive: false, include: ['*.html'] })).toStrictEqual([]);
});

test('a glob with a slash picks a path under a recursive walk', async () => {
  expect(await walkFolder(folder, { recursive: true, include: ['inner/*.pdf'] })).toStrictEqual([
    at('inner', 'c.pdf'),
  ]);
});

test('an explicit file is taken as it is, even a script, and the order of the arguments holds', async () => {
  const walk = { recursive: true, include: ['*.pdf'] };
  expect(await expandPaths([at('run.py'), at('inner'), at('notes.txt')], walk)).toStrictEqual([
    at('run.py'),
    at('inner', 'c.pdf'),
    at('inner', 'deep', 'd.pdf'),
    at('notes.txt'),
  ]);
});

test('a path that does not exist stays in the list, so the run refuses it with a reason', async () => {
  const walk = { recursive: false, include: ['*.pdf'] };
  expect(await expandPaths([at('absent.pdf')], walk)).toStrictEqual([at('absent.pdf')]);
});
