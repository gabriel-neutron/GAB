// The layers of a zip archive that holds GeoJSON files, as CSV text. A layer is one member of the
// archive. It becomes one table with a row for each feature: the columns are the properties, and
// the last column holds the geometry as JSON. A feature with no geometry keeps its row with an
// empty geometry cell. The member is read as a stream, so a large layer costs the memory of the
// rows that are kept. The same bytes and the same filter always give the same text (decisions.md
// S2, ADR 0012).

import { StringDecoder } from 'node:string_decoder';

import {
  csvOf,
  KeptRows,
  openArchive,
  type TableFilter,
  type TableInput,
  WorkbookFault,
} from './xlsx.ts';
import { partChunks } from './zip.ts';

/** The type of a zip archive. */
export const ZIP_MIME = 'application/zip';

/** The version of the reader of a layer. It is in the name of each text set. */
export const LAYER_READER = 'geojson-1';

/** The column that holds the geometry of a feature. */
export const GEOMETRY_COLUMN = 'geometry';

// A zip archive made on a Mac holds a folder of resource forks, and any system adds hidden files.
// They are no layer, and one bad entry never stops the read.
const isSystemEntry = (name: string): boolean => {
  const base = name.slice(name.lastIndexOf('/') + 1);
  return (
    name.endsWith('/') ||
    name.startsWith('__MACOSX/') ||
    base.startsWith('.') ||
    base.toLowerCase() === 'thumbs.db'
  );
};

const isLayer = (name: string): boolean => /\.(?:geo)?json$/iu.test(name) && !isSystemEntry(name);

/** The names of the layers of an archive, in the order of its directory. */
export const layerNames = async (input: TableInput): Promise<string[]> =>
  [...(await openArchive(input)).entries.keys()].filter(isLayer);

/** The name of a text set of a layer. The same layer and the same filter give the same name. */
export const layerSetName = (layer: string, filter?: TableFilter): string =>
  `${LAYER_READER}|layer=${layer}` +
  (filter === undefined ? '' : `|where=${filter.column}=${filter.value}`);

/** The most characters of the text of one feature, and the most property keys of one layer. A
 * layer with a larger feature or more keys is no table that a mapping can read. */
export const MAX_FEATURE_CHARS = 8 * 1024 * 1024;
export const MAX_PROPERTY_KEYS = 1000;

const tooLarge = (): WorkbookFault =>
  new WorkbookFault(
    `a feature of the layer is larger than ${String(MAX_FEATURE_CHARS)} characters`,
  );

const QUOTE = 34;
const BACKSLASH = 92;
const OPEN_OBJECT = 123;
const CLOSE_OBJECT = 125;
const OPEN_ARRAY = 91;
const CLOSE_ARRAY = 93;

// shortcut: an object that is a direct member of an array of the root is read as a feature, and the
// read keeps it only when its type is Feature. A root that is no FeatureCollection with the
// features at the top gives no row. Upgrade when a layer nests its features deeper.
async function* featureTexts(chunks: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
  const decoder = new StringDecoder('utf8');
  let depth = 0;
  let inString = false;
  let escaped = false;
  let collecting = false;
  let piece = '';
  for await (const chunk of chunks) {
    const text = decoder.write(Buffer.from(chunk));
    let from = 0;
    for (let at = 0; at < text.length; at += 1) {
      const code = text.charCodeAt(at);
      if (inString) {
        if (escaped) escaped = false;
        else if (code === BACKSLASH) escaped = true;
        else if (code === QUOTE) inString = false;
        continue;
      }
      if (code === QUOTE) inString = true;
      else if (code === OPEN_OBJECT || code === OPEN_ARRAY) {
        if (code === OPEN_OBJECT && depth === 2 && !collecting) {
          collecting = true;
          from = at;
        }
        depth += 1;
      } else if (code === CLOSE_OBJECT || code === CLOSE_ARRAY) {
        depth -= 1;
        if (collecting && depth === 2) {
          if (piece.length + (at + 1 - from) > MAX_FEATURE_CHARS) throw tooLarge();
          yield piece + text.slice(from, at + 1);
          piece = '';
          collecting = false;
        }
      }
    }
    if (collecting) {
      piece += text.slice(from);
      if (piece.length > MAX_FEATURE_CHARS) throw tooLarge();
    }
  }
}

interface Feature {
  readonly properties: Readonly<Record<string, unknown>>;
  readonly geometry: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

async function* features(input: TableInput, layer: string): AsyncGenerator<Feature> {
  const archive = await openArchive(input);
  const entry = archive.entries.get(layer);
  if (entry === undefined || !isLayer(layer))
    throw new WorkbookFault(`the archive has no layer named "${layer}"`);
  for await (const text of featureTexts(partChunks(archive.source, entry))) {
    let one: unknown;
    try {
      one = JSON.parse(text);
    } catch (fault) {
      throw new WorkbookFault(`the layer "${layer}" holds a feature that is no JSON`, {
        cause: fault,
      });
    }
    if (!isRecord(one) || one['type'] !== 'Feature') continue;
    const { properties, geometry } = one;
    yield { properties: isRecord(properties) ? properties : {}, geometry };
  }
}

const cellOf = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return JSON.stringify(value);
};

// shortcut: the geometry cell is the JSON text of the parsed geometry, so a coordinate keeps the
// shortest text of its double (1.0 becomes 1) and a coordinate of more than 17 digits loses the
// rest. Upgrade when a file needs the exact source text.
/** One layer as CSV text: the header row, then each feature that the filter keeps. The header
 * holds each property key in the order that the layer first shows it, then the geometry column
 * (`geometry`, with `_` added while a property has that name). The kept text is capped.
 * `maxRows` stops the read after that many kept rows. */
export const layerCsv = async (
  input: TableInput,
  layer: string,
  filter?: TableFilter,
  maxRows?: number,
): Promise<string> => {
  const keys = new Set<string>();
  for await (const feature of features(input, layer))
    for (const key of Object.keys(feature.properties)) {
      keys.add(key);
      if (keys.size > MAX_PROPERTY_KEYS)
        throw new WorkbookFault(
          `the layer "${layer}" has more than ${String(MAX_PROPERTY_KEYS)} property keys`,
        );
    }
  // A property named like the geometry column keeps its name, and the geometry column moves.
  let geometryColumn = GEOMETRY_COLUMN;
  while (keys.has(geometryColumn)) geometryColumn += '_';
  const header = [...keys, geometryColumn];
  if (filter !== undefined && !keys.has(filter.column))
    throw new WorkbookFault(`the layer "${layer}" has no column "${filter.column}"`);

  const kept = new KeptRows();
  for await (const feature of features(input, layer)) {
    if (filter !== undefined && cellOf(feature.properties[filter.column]).trim() !== filter.value)
      continue;
    kept.add(
      [...[...keys].map((key) => cellOf(feature.properties[key])), cellOf(feature.geometry)],
      `layer "${layer}"`,
    );
    if (maxRows !== undefined && kept.length >= maxRows) break;
  }
  return csvOf([header]) + kept.text();
};
