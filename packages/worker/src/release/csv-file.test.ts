import { expect, test } from 'vitest';

import { csvFile } from './csv-file.ts';

const BOM = '\uFEFF';

test('the file holds the preamble as comment lines, then the header and the rows', () => {
  const text = csvFile('**About.** One line.\n\nLast line.', ['id', 'label'], [['1', 'A ship']]);
  expect(text).toBe(
    `${BOM}# **About.** One line.\r\n#\r\n# Last line.\r\nid,label\r\n1,A ship\r\n`,
  );
});

test('a field with a comma, a quote or a line break is quoted, and a quote is doubled', () => {
  const text = csvFile('', ['a', 'b', 'c'], [['x, y', 'say "no"', 'one\ntwo']]);
  expect(text).toBe(`${BOM}a,b,c\r\n"x, y","say ""no""","one\ntwo"\r\n`);
});

test('a text that a spreadsheet runs as a formula is kept as text, and a number stays a number', () => {
  const text = csvFile('', ['v'], [['=HYPERLINK("x")'], ['+1 2'], ['@cmd'], ['-12.5'], ['-0- ']]);
  expect(text).toBe(`${BOM}v\r\n"'=HYPERLINK(""x"")"\r\n'+1 2\r\n'@cmd\r\n-12.5\r\n'-0- \r\n`);
});
