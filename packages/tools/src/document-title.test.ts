import { expect, test } from 'vitest';

import { firstLine, isWeakTitle, readableTitle } from './document-title.ts';

test.each([
  ['', true],
  ['   ', true],
  ['https://example.org/a/b.pdf', true],
  ['example.org/files/2026/act.pdf', true],
  ['/home/user/inbox/act.pdf', true],
  ['C:\\inbox\\act.pdf', true],
  ['act.pdf', true],
  ['/home/user/my inbox/act', true],
  ['inbox/my act.pdf', true],
  ['Rosneft.Report', false],
  ['Rosneft annual report', false],
  ['example.org/files/act.pdf (saved by the browser)', true],
  ['inbox/act.pdf (in archive.zip)', true],
  ['Council Regulation (EU) 2026/12', false],
  ['Press release on a new designation', false],
  ['Annual report 2025', false],
])('the title %j is weak: %s', (title, weak) => {
  expect(isWeakTitle(title)).toBe(weak);
});

test('the first line of a PDF with no title is its heading', () => {
  const pages = ['\n  12 \n\n  COUNCIL REGULATION (EU) 2026/12\nof 3 May 2026\n', 'second page'];
  expect(firstLine(pages)).toBe('COUNCIL REGULATION (EU) 2026/12');
});

test('a line with no letter is not a heading', () => {
  expect(firstLine(['1\n2026-05-03\n---\nThe report\n'])).toBe('The report');
});

test('a text with no usable line gives nothing', () => {
  expect(firstLine(['', ' 3 '])).toBeNull();
  expect(firstLine([])).toBeNull();
});

test('a long line is cut at a word', () => {
  const line = `${'word '.repeat(80)}end`;
  const cut = firstLine([line]);
  expect(cut?.length).toBeLessThanOrEqual(200);
  expect(cut?.endsWith('word')).toBe(true);
});

test('a readable title stays as it is', () => {
  expect(readableTitle('Annual report 2025', ['Other heading'])).toBe('Annual report 2025');
});

test('a weak title takes the first line, and keeps its note', () => {
  expect(readableTitle('example.org/a/act.pdf', ['Act on ships\ntext'])).toBe('Act on ships');
  expect(readableTitle('inbox/act.pdf (in archive.zip)', ['Act on ships\ntext'])).toBe(
    'Act on ships (in archive.zip)',
  );
});

test('a weak title with no usable line takes the name of the file with no extension', () => {
  expect(readableTitle('example.org/a/ship-list.pdf', [' '])).toBe('ship list');
  expect(readableTitle('example.org/a/ship-list.pdf (saved by the browser)', ['3'])).toBe(
    'ship list (saved by the browser)',
  );
  expect(readableTitle('https://example.org/', [], 'https://example.org/')).toBe('example.org');
});

test('a weak title with nothing to read in it stays', () => {
  expect(readableTitle('/12.pdf', [])).toBe('/12.pdf');
});
