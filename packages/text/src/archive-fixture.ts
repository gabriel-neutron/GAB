// Archives built for a test, in the shape of the published files: a zip archive with GeoJSON
// layers, and a workbook far larger than the memory of the test. A fixture is code and not a
// binary, so no real file of a publisher enters the repository.

import { open } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { crc32, createDeflateRaw } from 'node:zlib';

import { zipOf } from './xlsx-fixture.ts';

/** One feature of a layer. */
export interface FixtureFeature {
  readonly properties: Readonly<Record<string, unknown>>;
  readonly geometry: unknown;
}

/** A zip archive with one GeoJSON layer for each key. A system entry and a text file stand beside
 * the layers, as they do in a published route archive. */
export const geojsonArchiveOf = (
  layers: Readonly<Record<string, readonly FixtureFeature[]>>,
  zip64 = false,
): Uint8Array =>
  zipOf(
    [
      ['README.txt', 'The layers of this archive are GeoJSON files.'],
      [`__MACOSX/._${Object.keys(layers)[0] ?? 'layer.geojson'}`, 'not a layer'],
      ...Object.entries(layers).map(([name, features]): [string, string] => [
        name,
        JSON.stringify({
          type: 'FeatureCollection',
          name,
          features: features.map((feature) => ({ type: 'Feature', ...feature })),
        }),
      ]),
      ['.DS_Store', 'not a layer'],
    ],
    zip64,
  );

const escaped = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const letters = (index: number): string =>
  (index >= 26 ? letters(Math.floor(index / 26) - 1) : '') + String.fromCharCode(65 + (index % 26));

/** Writes a workbook of one sheet to a file, row after row, so a test can make a sheet far larger
 * than its memory. A text is an inline string. Row 0 is the header. */
export const writeLargeWorkbook = async (
  path: string,
  sheet: string,
  rowCount: number,
  rowOf: (index: number) => readonly string[],
): Promise<void> => {
  const handle = await open(path, 'w');
  const directory: Buffer[] = [];
  let offset = 0;
  const put = async (bytes: Uint8Array): Promise<void> => {
    await handle.write(bytes);
    offset += bytes.length;
  };
  const part = async (name: string, texts: Iterable<string>): Promise<void> => {
    const label = Buffer.from(name);
    const start = offset;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(label.length, 26);
    await put(local);
    await put(label);
    let crc = 0;
    let size = 0;
    let packed = 0;
    const source = Readable.from(
      (function* () {
        for (const text of texts) {
          const bytes = Buffer.from(text);
          crc = crc32(bytes, crc);
          size += bytes.length;
          yield bytes;
        }
      })(),
    );
    for await (const chunk of source.pipe(createDeflateRaw())) {
      packed += (chunk as Buffer).length;
      await put(chunk as Buffer);
    }
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed, 20);
    entry.writeUInt32LE(size, 24);
    entry.writeUInt16LE(label.length, 28);
    entry.writeUInt32LE(start, 42);
    directory.push(entry, label);
  };
  // The sizes of a streamed part are unknown at its header, so the header holds none and the
  // directory holds them.
  function* rows(): Generator<string> {
    yield '<worksheet><sheetData>';
    for (let index = 0; index <= rowCount; index += 1) {
      const number = String(index + 1);
      const cells = rowOf(index).map(
        (text, column) =>
          `<c r="${letters(column)}${number}" t="inlineStr"><is><t>${escaped(text)}</t></is></c>`,
      );
      yield `<row r="${number}">${cells.join('')}</row>`;
    }
    yield '</sheetData></worksheet>';
  }
  try {
    await part('[Content_Types].xml', ['<Types/>']);
    await part('xl/workbook.xml', [
      `<workbook><sheets><sheet name="${escaped(sheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ]);
    await part('xl/_rels/workbook.xml.rels', [
      '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ]);
    await part('xl/worksheets/sheet1.xml', rows());
    const body = Buffer.concat(directory);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(4, 8);
    end.writeUInt16LE(4, 10);
    end.writeUInt32LE(body.length, 12);
    end.writeUInt32LE(offset, 16);
    await put(body);
    await put(end);
  } finally {
    await handle.close();
  }
};
