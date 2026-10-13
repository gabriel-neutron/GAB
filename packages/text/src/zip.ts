// A zip archive read through random access, so the reader holds the directory and one chunk of one
// part in memory, never the whole file. A part comes out as a stream of inflated chunks. The
// reader knows Zip64, so an archive of more than 4 GiB or 65,535 parts is read too. node:zlib
// inflates, so no dependency is added.

import { open } from 'node:fs/promises';
import { Readable, pipeline } from 'node:stream';
import { createInflateRaw } from 'node:zlib';

/** An archive that code cannot read. */
export class WorkbookFault extends Error {
  constructor(reason: string, options?: ErrorOptions) {
    super(reason, options);
    this.name = 'WorkbookFault';
  }
}

/** The bytes of a file, read at an offset. A source of bytes in memory and a source of a file on
 * disk have the same shape. */
export interface ZipSource {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}

/** A source that holds its bytes in memory. */
export const bytesSource = (bytes: Uint8Array): ZipSource => ({
  size: bytes.length,
  read: (offset, length) => Promise.resolve(bytes.subarray(offset, offset + length)),
});

/** A source over a file on disk, and the call that closes it. */
export const fileSource = async (path: string): Promise<ZipSource & { close(): Promise<void> }> => {
  const handle = await open(path, 'r');
  const { size } = await handle.stat();
  return {
    size,
    read: async (offset, length) => {
      const buffer = Buffer.alloc(Math.min(length, Math.max(0, size - offset)));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
      return buffer.subarray(0, bytesRead);
    },
    close: () => handle.close(),
  };
};

const END_OF_DIRECTORY = 0x06054b50;
const ZIP64_END = 0x06064b50;
const ZIP64_LOCATOR = 0x07064b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_ENTRY = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;
const LOOKBACK = 22 + 20 + 0xffff;
const MAX16 = 0xffff;
const MAX32 = 0xffffffff;
const CHUNK = 1024 * 1024;

/** The most bytes that a part read as one text may inflate to. A small archive can hold a part of
 * many gigabytes (a zip bomb). */
export const MAX_PART_BYTES = 128 * 1024 * 1024;

/** The most bytes that a streamed part may inflate to. The stream holds one chunk, so the cap
 * bounds the time of a read and not its memory. */
export const MAX_STREAM_BYTES = 4 * 1024 * 1024 * 1024;

const MAX_DIRECTORY_BYTES = 256 * 1024 * 1024;

export interface ZipEntry {
  readonly name: string;
  readonly method: number;
  readonly compressed: number;
  readonly size: number;
  readonly local: number;
}

const viewOf = (bytes: Uint8Array): DataView =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const extraNumbers = (
  extra: DataView,
  wanted: { size: boolean; compressed: boolean; local: boolean },
): { size?: number; compressed?: number; local?: number } => {
  const found: { size?: number; compressed?: number; local?: number } = {};
  for (let at = 0; at + 4 <= extra.byteLength;) {
    const id = extra.getUint16(at, true);
    const length = extra.getUint16(at + 2, true);
    if (id === 1) {
      let cursor = at + 4;
      for (const key of ['size', 'compressed', 'local'] as const) {
        if (!wanted[key]) continue;
        if (cursor + 8 > at + 4 + length) throw new WorkbookFault('a Zip64 field is too short');
        found[key] = Number(extra.getBigUint64(cursor, true));
        cursor += 8;
      }
    }
    at += 4 + length;
  }
  return found;
};

/** The parts of an archive by name. */
export const zipEntries = async (source: ZipSource): Promise<Map<string, ZipEntry>> => {
  const tailFrom = Math.max(0, source.size - LOOKBACK);
  const tail = await source.read(tailFrom, source.size - tailFrom);
  const view = viewOf(tail);
  let end = tail.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== END_OF_DIRECTORY) end -= 1;
  if (end < 0) throw new WorkbookFault('the file is no zip archive, so it is no XLSX workbook');

  let count = view.getUint16(end + 10, true);
  let size = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);
  if (count === MAX16 || size === MAX32 || offset === MAX32) {
    if (end < 20 || view.getUint32(end - 20, true) !== ZIP64_LOCATOR)
      throw new WorkbookFault('the Zip64 locator of the zip archive is missing');
    const at = Number(view.getBigUint64(end - 20 + 8, true));
    const record = viewOf(await source.read(at, 56));
    if (record.byteLength < 56 || record.getUint32(0, true) !== ZIP64_END)
      throw new WorkbookFault('the Zip64 directory of the zip archive is broken');
    count = Number(record.getBigUint64(32, true));
    size = Number(record.getBigUint64(40, true));
    offset = Number(record.getBigUint64(48, true));
  }
  if (size > MAX_DIRECTORY_BYTES)
    throw new WorkbookFault('the directory of the zip archive is huge');

  const directory = await source.read(offset, size);
  const dir = viewOf(directory);
  const found = new Map<string, ZipEntry>();
  let at = 0;
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > directory.length || dir.getUint32(at, true) !== DIRECTORY_ENTRY)
      throw new WorkbookFault('the directory of the zip archive is broken');
    const method = dir.getUint16(at + 10, true);
    let compressed = dir.getUint32(at + 20, true);
    let uncompressed = dir.getUint32(at + 24, true);
    let local = dir.getUint32(at + 42, true);
    const nameLength = dir.getUint16(at + 28, true);
    const extraLength = dir.getUint16(at + 30, true);
    const name = new TextDecoder().decode(directory.subarray(at + 46, at + 46 + nameLength));
    if (compressed === MAX32 || uncompressed === MAX32 || local === MAX32) {
      const extra = viewOf(
        directory.subarray(at + 46 + nameLength, at + 46 + nameLength + extraLength),
      );
      const big = extraNumbers(extra, {
        size: uncompressed === MAX32,
        compressed: compressed === MAX32,
        local: local === MAX32,
      });
      uncompressed = big.size ?? uncompressed;
      compressed = big.compressed ?? compressed;
      local = big.local ?? local;
    }
    at += 46 + nameLength + extraLength + dir.getUint16(at + 32, true);
    found.set(name, { name, method, compressed, size: uncompressed, local });
  }
  return found;
};

async function* rawChunks(source: ZipSource, entry: ZipEntry): AsyncGenerator<Uint8Array> {
  const head = await source.read(entry.local, 30);
  if (head.length < 30 || viewOf(head).getUint32(0, true) !== LOCAL_ENTRY)
    throw new WorkbookFault(`the part ${entry.name} of the zip archive is broken`);
  const view = viewOf(head);
  let from = entry.local + 30 + view.getUint16(26, true) + view.getUint16(28, true);
  const to = from + entry.compressed;
  while (from < to) {
    const chunk = await source.read(from, Math.min(CHUNK, to - from));
    if (chunk.length === 0) throw new WorkbookFault(`the part ${entry.name} is cut short`);
    yield chunk;
    from += chunk.length;
  }
}

/** The inflated chunks of one part. It refuses a part that inflates past the limit. */
export async function* partChunks(
  source: ZipSource,
  entry: ZipEntry,
  limit: number = MAX_STREAM_BYTES,
): AsyncGenerator<Buffer> {
  if (entry.method !== STORED && entry.method !== DEFLATED)
    throw new WorkbookFault(`the part ${entry.name} uses the zip method ${String(entry.method)}`);
  const raw = Readable.from(rawChunks(source, entry), { objectMode: false });
  const stream =
    entry.method === DEFLATED ? pipeline(raw, createInflateRaw(), () => undefined) : raw;
  let total = 0;
  try {
    for await (const chunk of stream) {
      const buffer = chunk as Buffer;
      total += buffer.length;
      if (total > limit)
        throw new WorkbookFault(
          `the part ${entry.name} of the zip archive inflates to more than ${String(limit)} bytes`,
        );
      yield buffer;
    }
  } catch (fault) {
    if (fault instanceof WorkbookFault) throw fault;
    throw new WorkbookFault(`the part ${entry.name} of the zip archive is broken`, {
      cause: fault,
    });
  } finally {
    stream.destroy();
  }
}

/** One part as a text, held in memory. It is for the small XML parts. */
export const partText = async (source: ZipSource, entry: ZipEntry): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of partChunks(source, entry, MAX_PART_BYTES)) chunks.push(chunk);
  return new TextDecoder().decode(Buffer.concat(chunks));
};
