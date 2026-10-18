// The files of a zip archive, each one as its bytes, for a store that makes one child document of
// each file. The read refuses a hostile archive before it inflates any file: too many files, too
// many bytes, a folder too deep, an archive inside the archive, a path that leaves the archive,
// or a file that inflates far past its compressed size (a zip bomb). A file then inflates to its
// stated size and no further.

import { bytesSource, partChunks, WorkbookFault, zipEntries, type ZipEntry } from './zip.ts';

/** An archive that the store does not unpack, with the reason. */
export class ArchiveRefusal extends Error {
  constructor(reason: string, options?: ErrorOptions) {
    super(reason, options);
    this.name = 'ArchiveRefusal';
  }
}

/** One file of an archive: its path in the archive and its bytes. */
export interface ArchiveFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

// Origin of the numbers: decided, not calibrated. A bulk file of OpenSanctions or of Eurostat
// Comext holds some tens of files and some hundreds of MiB, and a fetch takes 20 MiB. The total
// is held in memory while the store reads the text of each file.
export const MAX_ARCHIVE_FILES = 500;
export const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
export const MAX_FILE_BYTES = 64 * 1024 * 1024;
/** The most folders above a file. */
export const MAX_FOLDER_DEPTH = 8;
/** A text file deflates to a tenth or a twentieth of its size. A file that inflates to more than
 * this many times its compressed size is a zip bomb. */
export const MAX_RATIO = 200;
// A small file can have a high ratio with no harm: a file of one repeated line is one example.
const RATIO_FROM_BYTES = 1024 * 1024;

const ARCHIVE_NAME = /\.(?:zip|jar|7z|rar|tar|tgz|gz|bz2|xz|zst)$/iu;
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

// A zip archive made on a Mac holds a folder of resource forks, and any system adds hidden files.
// They are no file of the source.
const isSystemEntry = (path: string): boolean => {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return path.startsWith('__MACOSX/') || base.startsWith('.') || base.toLowerCase() === 'thumbs.db';
};

/** The reason that a path leaves the archive or cannot be a plain path, or null. */
const pathFault = (path: string): string | null => {
  if (path.includes('\\')) return `the path ${path} holds a backslash`;
  if (path.startsWith('/') || /^[a-z]:/iu.test(path))
    return `the path ${path} starts at the root of a disk and leaves the archive`;
  if (/\p{Cc}/u.test(path)) return `the path ${JSON.stringify(path)} holds a control character`;
  const parts = path.split('/');
  if (parts.some((part) => part === '..')) return `the path ${path} leaves the archive`;
  if (parts.some((part) => part === '' || part === '.'))
    return `the path ${path} holds an empty folder name`;
  return null;
};

const opensAsZip = (bytes: Uint8Array): boolean =>
  ZIP_MAGIC.every((byte, index) => bytes[index] === byte);

// Every check that the directory permits, before any file is inflated.
const checkedEntries = (entries: Map<string, ZipEntry>): ZipEntry[] => {
  const files: ZipEntry[] = [];
  let total = 0;
  for (const entry of entries.values()) {
    const fault = pathFault(entry.name.endsWith('/') ? entry.name.slice(0, -1) : entry.name);
    if (fault !== null) throw new ArchiveRefusal(fault);
    if (entry.name.endsWith('/') || isSystemEntry(entry.name)) continue;
    if (entry.name.split('/').length - 1 > MAX_FOLDER_DEPTH)
      throw new ArchiveRefusal(
        `the file ${entry.name} is more than ${String(MAX_FOLDER_DEPTH)} folders deep`,
      );
    if (ARCHIVE_NAME.test(entry.name))
      throw new ArchiveRefusal(
        `the file ${entry.name} is an archive inside the archive, and only one level is unpacked`,
      );
    if (entry.size > MAX_FILE_BYTES)
      throw new ArchiveRefusal(
        `the file ${entry.name} inflates to more than ${String(MAX_FILE_BYTES)} bytes`,
      );
    if (entry.size > RATIO_FROM_BYTES && entry.size > MAX_RATIO * Math.max(1, entry.compressed))
      throw new ArchiveRefusal(
        `the file ${entry.name} inflates to more than ${String(MAX_RATIO)} times its compressed ` +
          'size, as a zip bomb does',
      );
    total += entry.size;
    if (total > MAX_ARCHIVE_BYTES)
      throw new ArchiveRefusal(
        `the files of the archive inflate to more than ${String(MAX_ARCHIVE_BYTES)} bytes`,
      );
    files.push(entry);
    if (files.length > MAX_ARCHIVE_FILES)
      throw new ArchiveRefusal(`the archive holds more than ${String(MAX_ARCHIVE_FILES)} files`);
  }
  return files;
};

/** The files of an archive, in the order of its directory, with no folder and no system file. It
 * throws an ArchiveRefusal for a hostile or broken archive. */
export const archiveFiles = async (bytes: Uint8Array): Promise<ArchiveFile[]> => {
  const source = bytesSource(bytes);
  try {
    const files: ArchiveFile[] = [];
    for (const entry of checkedEntries(await zipEntries(source))) {
      // The directory states the size, and a file that inflates past it lies about it.
      const chunks: Buffer[] = [];
      for await (const chunk of partChunks(source, entry, entry.size)) chunks.push(chunk);
      const held = new Uint8Array(Buffer.concat(chunks));
      if (held.length !== entry.size)
        throw new ArchiveRefusal(
          `the file ${entry.name} inflates to ${String(held.length)} bytes, and the archive ` +
            `states ${String(entry.size)}`,
        );
      if (opensAsZip(held))
        throw new ArchiveRefusal(
          `the file ${entry.name} is an archive inside the archive, and only one level is unpacked`,
        );
      files.push({ path: entry.name, bytes: held });
    }
    return files;
  } catch (fault) {
    if (fault instanceof ArchiveRefusal) throw fault;
    if (fault instanceof WorkbookFault)
      throw new ArchiveRefusal(fault.message.replace(', so it is no XLSX workbook', ''), {
        cause: fault,
      });
    throw new ArchiveRefusal('the zip archive is broken', { cause: fault });
  }
};
