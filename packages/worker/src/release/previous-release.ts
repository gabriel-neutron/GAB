import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

import { readReleaseTables, ReleaseTableFault, type ReleaseTables } from './release-table.ts';

/** The folder of the previous release is refused. The message names the file to check. */
export class PreviousReleaseFault extends Error {}

/** The previous release, read back from its folder. */
export interface PreviousRelease {
  readonly version: string;
  /** The day of the release, ISO 8601. */
  readonly date: string;
  readonly tables: ReleaseTables;
}

const FILE_MANIFEST = 'manifest.json';

// A path of the file manifest names a file of the folder itself. A path with a separator could
// read a file out of the folder.
const fileManifest = z.object({
  version: z.string(),
  date: z.iso.date(),
  files: z.array(
    z.object({
      path: z.string(),
      bytes: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/u),
    }),
  ),
});

const PLAIN_NAME = /^[\w-][\w.-]*$/u;

const refuse = (folder: string, why: string): never => {
  throw new PreviousReleaseFault(`The previous release ${folder} is refused: ${why}.`);
};

/** Reads the previous release from its folder. Each file of its file manifest must agree with
 * its size and its checksum, so a copy that changed after the release is refused. The folder
 * must hold the entities, the relations, the claims and the merges. */
export const readPreviousRelease = async (folder: string): Promise<PreviousRelease> => {
  let json: unknown;
  try {
    json = JSON.parse(await readFile(join(folder, FILE_MANIFEST), 'utf8'));
  } catch {
    return refuse(folder, `${FILE_MANIFEST} cannot be read as JSON`);
  }
  const read = fileManifest.safeParse(json);
  if (!read.success) return refuse(folder, `${FILE_MANIFEST} is not the manifest of a release`);

  const texts = new Map<string, string>();
  for (const file of read.data.files) {
    if (!PLAIN_NAME.test(file.path))
      refuse(folder, `${FILE_MANIFEST} lists ${file.path}, which is not a file of the folder`);
    let bytes;
    try {
      bytes = await readFile(join(folder, file.path));
    } catch {
      return refuse(folder, `${file.path} cannot be read`);
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== file.bytes || sha256 !== file.sha256)
      refuse(folder, `${file.path} does not agree with its size and its checksum`);
    try {
      texts.set(file.path, new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      refuse(folder, `${file.path} is not UTF-8`);
    }
  }

  try {
    return {
      version: read.data.version,
      date: read.data.date,
      tables: readReleaseTables((path) => texts.get(path)),
    };
  } catch (fault) {
    if (!(fault instanceof ReleaseTableFault)) throw fault;
    return refuse(folder, fault.message);
  }
};
