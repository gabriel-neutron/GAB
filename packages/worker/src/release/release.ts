import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Queryable } from '../queryable.ts';
import { CriticalNodesSheetFault, readCriticalNodesSheet } from './critical-nodes-sheet.ts';
import { PreviousReleaseFault, readPreviousRelease } from './previous-release.ts';
import { releaseFiles } from './release-files.ts';
import type { ReleaseManifest } from './release-manifest.ts';
import { readReleaseRecord } from './release-record.ts';
import {
  readVolumeTable,
  VolumeTableFault,
  type VolumeRejection,
  type VolumeTable,
} from './volume-table.ts';

/** A release of the same date is in the folder already. */
export class ReleaseFolderExists extends Error {}

/** A release that the command wrote. */
export interface WrittenRelease {
  readonly folder: string;
  readonly entities: number;
  readonly relations: number;
  readonly claims: number;
  /** The rows of the volume table that the release left out, with the reason. */
  readonly volumeRejections: readonly VolumeRejection[];
  /** The rows of the volume table that join no link because a label names more than one entity,
   * with the reason. */
  readonly volumesUnjoined: readonly VolumeRejection[];
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

/** Reads the volume table at its path, or gives null when the manifest names none: the release
 * then has no volume. */
const readVolumes = async (path: string | null): Promise<VolumeTable | null> => {
  if (path === null) return null;
  let bytes;
  try {
    bytes = await readFile(path);
  } catch {
    throw new VolumeTableFault(`Cannot read the volume table ${path}.`);
  }
  return readVolumeTable(bytes);
};

/** Reads the public part of the record and writes one release folder, named by its date, in
 * `root`. The folder holds each file, the changelog since the release in `previousFolder` (or a
 * first release with none), then the file manifest with the checksum of each file. A folder of
 * the same date is never overwritten. `finish` gets the hidden folder with each file, before the
 * folder takes its name: when it fails, no release folder is left. A sheet of the candidate nodes that is refused, a
 * volume table that cannot be read, or a previous release that is refused or not earlier, stops
 * the release before it writes a file. */
export const writeRelease = async (
  db: Queryable,
  manifest: ReleaseManifest,
  root: string,
  previousFolder: string | null = null,
  finish: ((folder: string) => Promise<void>) | null = null,
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
  const volumes = await readVolumes(manifest.volumes);
  const record = await readReleaseRecord(db, {
    natoPair: manifest.showNatoPair,
    cited: new Set(volumes?.rows.map((one) => one.document)),
  });
  const { files, volumeRejections, volumesUnjoined } = releaseFiles(
    record,
    manifest,
    sheet,
    previous,
    volumes,
  );

  // The files go to a hidden folder first, so a run that stops leaves no half release under the
  // name of the date.
  await mkdir(root, { recursive: true });
  const partial = await mkdtemp(join(root, '.gab-release-'));
  try {
    for (const file of files) await writeFile(join(partial, file.path), file.text);
    if (finish !== null) await finish(partial);
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
    volumeRejections,
    volumesUnjoined,
  };
};
