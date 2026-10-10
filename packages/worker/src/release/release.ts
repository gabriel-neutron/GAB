import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Queryable } from '../queryable.ts';
import { CriticalNodesSheetFault, readCriticalNodesSheet } from './critical-nodes-sheet.ts';
import { PreviousReleaseFault, readPreviousRelease } from './previous-release.ts';
import { releaseFiles } from './release-files.ts';
import type { ReleaseManifest } from './release-manifest.ts';
import { readReleaseRecord } from './release-record.ts';

/** A release of the same date is in the folder already. */
export class ReleaseFolderExists extends Error {}

/** A release that the command wrote. */
export interface WrittenRelease {
  readonly folder: string;
  readonly entities: number;
  readonly relations: number;
  readonly claims: number;
}

const exists = async (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

/** Reads the sheet of the candidate nodes at its path, or gives null when the manifest names
 * none. */
const readSheet = async (path: string | null) => {
  if (path === null) return null;
  let bytes;
  try {
    bytes = await readFile(path);
  } catch {
    throw new CriticalNodesSheetFault(`Cannot read the sheet of the candidate nodes ${path}.`);
  }
  return readCriticalNodesSheet(bytes);
};

/** Reads the public part of the record and writes one release folder, named by its date, in
 * `root`. The folder holds each file, the changelog since the release in `previousFolder` (or a
 * first release with none), then the file manifest with the checksum of each file. A folder of
 * the same date is never overwritten. A sheet of the candidate nodes that is refused, or a
 * previous release that is refused or not earlier, stops the release before it writes a file. */
export const writeRelease = async (
  db: Queryable,
  manifest: ReleaseManifest,
  root: string,
  previousFolder: string | null = null,
): Promise<WrittenRelease> => {
  const folder = join(root, `gab-release-${manifest.date}`);
  if (await exists(folder))
    throw new ReleaseFolderExists(
      `The release folder ${folder} exists already. A release never writes over another one.`,
    );
  const previous = previousFolder === null ? null : await readPreviousRelease(previousFolder);
  if (previous !== null && previous.date >= manifest.date)
    throw new PreviousReleaseFault(
      `The previous release is of ${previous.date}, which is not before ${manifest.date}.`,
    );

  const sheet = await readSheet(manifest.criticalNodes);
  const record = await readReleaseRecord(db, { natoPair: manifest.showNatoPair });
  const files = releaseFiles(record, manifest, sheet, previous);

  // The files go to a hidden folder first, so a run that stops leaves no half release under the
  // name of the date.
  await mkdir(root, { recursive: true });
  const partial = await mkdtemp(join(root, '.gab-release-'));
  try {
    for (const file of files) await writeFile(join(partial, file.path), file.text);
    await rename(partial, folder);
  } catch (fault) {
    await rm(partial, { recursive: true, force: true });
    throw fault;
  }
  return {
    folder,
    entities: record.entities.length,
    relations: record.relations.length,
    claims: record.claims.length,
  };
};
