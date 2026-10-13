// The child process of the memory test. A fresh process has a peak RSS that no earlier test moved,
// so the growth of the peak is the cost of the read alone. It prints the growth in mebibytes and
// the number of lines that the read kept.

import { sheetCsv } from './xlsx.ts';
import { fileSource } from './zip.ts';

const [path] = process.argv.slice(2);
if (path === undefined) throw new Error('give the path of the workbook');

const source = await fileSource(path);
try {
  const before = process.resourceUsage().maxRSS;
  const text = await sheetCsv(source, 'Data', { column: 'Country', value: 'Russia' });
  const growth = (process.resourceUsage().maxRSS - before) / 1024;
  console.log(JSON.stringify({ growth, lines: text.split('\r\n').length }));
} finally {
  await source.close();
}
