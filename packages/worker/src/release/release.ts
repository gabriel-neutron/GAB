import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Queryable } from '../queryable.ts';
import { csvExport, type ReleaseFile } from './csv-export.ts';
import { releaseDisclaimer } from './disclaimer.ts';
import type { ReleaseManifest } from './release-manifest.ts';
import { readReleaseRecord } from './release-record.ts';

/** The file that lists each file of a release with its checksum. */
const FILE_MANIFEST = 'manifest.json';

/** A release of the same date is in the folder already. */
export class ReleaseFolderExists extends Error {}

/** A release that the command wrote. */
export interface WrittenRelease {
  readonly folder: string;
  readonly entities: number;
  readonly relations: number;
  readonly claims: number;
}

const dayOfRelease = (date: string): string => {
  const [year, month, day] = date.split('-');
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`;
};

const exists = async (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

/** Reads the public part of the record and writes one release folder, named by its date, in
 * `root`. The folder holds each file, then the file manifest with the checksum of each file. A
 * folder of the same date is never overwritten. */
export const writeRelease = async (
  db: Queryable,
  manifest: ReleaseManifest,
  root: string,
): Promise<WrittenRelease> => {
  const folder = join(root, `gab-release-${manifest.date}`);
  if (await exists(folder))
    throw new ReleaseFolderExists(
      `The release folder ${folder} exists already. A release never writes over another one.`,
    );

  const record = await readReleaseRecord(db);
  const disclaimer = releaseDisclaimer(record.disclaimer, manifest.contacts);
  const preamble = `GAB dataset, version ${manifest.version} of ${dayOfRelease(manifest.date)}.\n\n${disclaimer}`;
  const files: readonly ReleaseFile[] = csvExport(record, preamble);

  const listed = files.map((file) => {
    const bytes = Buffer.from(file.text, 'utf8');
    return {
      path: file.path,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  });
  const fileManifest = {
    dataset: 'GAB',
    version: manifest.version,
    date: manifest.date,
    disclaimer,
    files: listed,
  };

  // The files go to a hidden folder first, so a run that stops leaves no half release under the
  // name of the date.
  await mkdir(root, { recursive: true });
  const partial = await mkdtemp(join(root, '.gab-release-'));
  try {
    for (const file of files) await writeFile(join(partial, file.path), file.text);
    await writeFile(join(partial, FILE_MANIFEST), `${JSON.stringify(fileManifest, null, 2)}\n`);
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
