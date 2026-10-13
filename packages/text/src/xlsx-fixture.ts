// A small XLSX workbook, built in memory for a test. A fixture in the shape of a published file
// is code and not a binary, so no real file of a publisher enters the repository.

import { crc32, deflateRawSync } from 'node:zlib';

const escaped = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const letters = (index: number): string =>
  (index >= 26 ? letters(Math.floor(index / 26) - 1) : '') + String.fromCharCode(65 + (index % 26));

/** A cell is a text, or a number written as the number it is. */
export type FixtureCell = string | number;

/** The zip entries, each one deflated except the first, which is stored. */
const zipOf = (entries: readonly (readonly [string, string])[]): Uint8Array => {
  const locals: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  entries.forEach(([name, text], index) => {
    const raw = Buffer.from(text);
    const stored = index === 0;
    const data = stored ? raw : deflateRawSync(raw);
    const label = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(label.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(stored ? 0 : 8, 10);
    entry.writeUInt32LE(crc32(raw), 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(label.length, 28);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, label, data);
    directory.push(entry, label);
    offset += 30 + label.length + data.length;
  });
  const body = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(body.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, body, end]));
};

/** A workbook with one sheet for each key, in the order of the keys. A text goes through the
 * shared strings, and a number is a numeric cell. An empty text leaves its cell out. */
export const workbookOf = (
  sheets: Readonly<Record<string, readonly (readonly FixtureCell[])[]>>,
) => {
  const strings: string[] = [];
  const indexOf = (text: string): number => {
    const found = strings.indexOf(text);
    if (found !== -1) return found;
    strings.push(text);
    return strings.length - 1;
  };
  const names = Object.keys(sheets);
  const sheetXml = names.map((name) => {
    const rows = (sheets[name] ?? []).map((row, r) => {
      const cells = row
        .map((cell, c) => {
          const at = `${letters(c)}${String(r + 1)}`;
          if (cell === '') return '';
          return typeof cell === 'number'
            ? `<c r="${at}"><v>${String(cell)}</v></c>`
            : `<c r="${at}" t="s"><v>${String(indexOf(cell))}</v></c>`;
        })
        .join('');
      return `<row r="${String(r + 1)}">${cells}</row>`;
    });
    return `<worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`;
  });
  return zipOf([
    ['[Content_Types].xml', '<Types/>'],
    [
      'xl/workbook.xml',
      `<workbook><sheets>${names
        .map(
          (name, i) =>
            `<sheet name="${escaped(name)}" sheetId="${String(i + 1)}" r:id="rId${String(i + 1)}"/>`,
        )
        .join('')}</sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `<Relationships>${names
        .map(
          (_, i) =>
            `<Relationship Id="rId${String(i + 1)}" Type="worksheet" Target="worksheets/sheet${String(i + 1)}.xml"/>`,
        )
        .join('')}</Relationships>`,
    ],
    ...sheetXml.map((xml, i): [string, string] => [`xl/worksheets/sheet${String(i + 1)}.xml`, xml]),
    [
      'xl/sharedStrings.xml',
      `<sst>${strings.map((text) => `<si><t>${escaped(text)}</t></si>`).join('')}</sst>`,
    ],
  ]);
};
