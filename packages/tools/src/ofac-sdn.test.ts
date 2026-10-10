import { expect, test } from 'vitest';

import { entryLine } from './ofac-sdn.ts';

const CSV =
  '36,"AEROCARIBBEAN AIRLINES",-0- ,"CUBA",-0- ,-0- \r\n' +
  '173,"ANGLO-CARIBBEAN CO., LTD.",-0- ,"CUBA",-0- ,-0- \r\n' +
  '1736,"SCF",-0- ,"RUSSIA-EO14024",-0- ,"Vessel"\r\n\u001a';

test.each([
  [36, '36,"AEROCARIBBEAN AIRLINES",-0- ,"CUBA",-0- ,-0- '],
  [173, '173,"ANGLO-CARIBBEAN CO., LTD.",-0- ,"CUBA",-0- ,-0- '],
  [17, null],
  [3, null],
])('the line of entry %i is found by its number at the start of a line', (entNum, line) => {
  expect(entryLine(CSV, entNum)).toBe(line);
});

test('a long line is clipped to the cap of an excerpt, and stays a quote of the file', () => {
  const long = `5,"${'X'.repeat(800)}"\n`;
  const line = entryLine(long, 5) ?? '';
  expect(line).toHaveLength(600);
  expect(long.startsWith(line)).toBe(true);
});

test('a clip never splits a character of two UTF-16 units', () => {
  const line = entryLine(`7,"${'\u{1F6A2}'.repeat(400)}"`, 7) ?? '';
  expect(line.length).toBeLessThanOrEqual(600);
  expect(line.endsWith('\u{1F6A2}')).toBe(true);
});
