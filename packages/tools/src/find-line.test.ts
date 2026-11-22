import { expect, test } from 'vitest';

import { findLine, linesHolding } from './find-line.ts';
import { callTool, type Session } from './tool.ts';

const PAGE = 'id,name\n1,Alpha\r\n2,Beta\n3,Alpha Alpha\n4,Gamma';

test('it gives the number and the text of each line that holds the text, once a line', () => {
  expect(linesHolding(PAGE, 'Alpha', 1, 10)).toStrictEqual({
    lines: [
      { line: 2, text: '1,Alpha', cut: false },
      { line: 4, text: '3,Alpha Alpha', cut: false },
    ],
    nextLine: null,
  });
});

test('it finds a key on the first and on the last line', () => {
  expect(linesHolding(PAGE, 'id,', 1, 10).lines[0]?.line).toBe(1);
  expect(linesHolding(PAGE, 'Gamma', 1, 10).lines).toStrictEqual([
    { line: 5, text: '4,Gamma', cut: false },
  ]);
});

test('a full list names the next line, and a read from it goes on', () => {
  const first = linesHolding(PAGE, 'Alpha', 1, 1);
  expect(first.lines.map((one) => one.line)).toStrictEqual([2]);
  expect(first.nextLine).toBe(4);
  expect(linesHolding(PAGE, 'Alpha', 4, 1).lines.map((one) => one.line)).toStrictEqual([4]);
});

test('a page that does not hold the text gives no line', () => {
  expect(linesHolding(PAGE, 'Delta', 1, 10)).toStrictEqual({ lines: [], nextLine: null });
});

test('a long line gives the part around the text', () => {
  const page = `${'x'.repeat(5000)},KEY1,${'y'.repeat(5000)}\nnext`;
  const [line] = linesHolding(page, 'KEY1', 1, 10).lines;
  expect(line?.cut).toBe(true);
  expect(line?.text).toContain('KEY1');
  expect(line?.text.length).toBe(2000);
  expect(page).toContain(line?.text);
});

test('a long line is cut between two characters, so the part is a quote of the page', () => {
  const emoji = '\u{1F600}';
  for (const before of [1000, 1001, 999]) {
    const page = `${emoji.repeat(1000)}${'y'.repeat(before)}KEY1${'y'.repeat(5000)}`;
    const [line] = linesHolding(page, 'KEY1', 1, 10).lines;
    expect(line?.text.isWellFormed()).toBe(true);
    expect(page).toContain(line?.text);
  }
});

// Pages of a stored file. Each statement names one page, and the test counts the statements.
const sessionOfPages = (pages: readonly string[], text: string) => {
  const asked: unknown[] = [];
  const session: Session = {
    query: (_statement, values) => {
      asked.push(values[2]);
      const page = pages[Number(values[2]) - 1];
      return Promise.resolve({
        rows:
          page === undefined ? [] : [{ page: values[2], text: page.includes(text) ? page : null }],
      });
    },
  };
  return { session, asked };
};

const DOCUMENT = 'doc_000000000000';

test('the walk reads one page a statement, and a miss ends at the end of the set', async () => {
  const { session, asked } = sessionOfPages(['a,b', 'c,d', 'e,f'], 'KEY1');
  const outcome = await callTool(findLine, session, { document: DOCUMENT, text: 'KEY1' });
  expect(outcome).toMatchObject({ ok: true, output: { lines: [], next: null } });
  expect(asked).toStrictEqual([1, 2, 3, 4]);
});

test('a page with no match does not end the walk, and a full list names the next page', async () => {
  const { session } = sessionOfPages(['h\nKEY1,a', 'c,d', 'h\nKEY1,b'], 'KEY1');
  const full = await callTool(findLine, session, { document: DOCUMENT, text: 'KEY1', limit: 1 });
  expect(full).toMatchObject({
    ok: true,
    output: { lines: [{ page: 1, line: 2, text: 'KEY1,a' }], next: { page: 3, line: 1 } },
  });
  const rest = await callTool(findLine, session, {
    document: DOCUMENT,
    text: 'KEY1',
    limit: 1,
    fromPage: 3,
  });
  expect(rest).toMatchObject({
    ok: true,
    output: { lines: [{ page: 3, line: 2, text: 'KEY1,b' }], next: null },
  });
});
