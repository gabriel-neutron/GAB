import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Queryable } from '../queryable.ts';
import { alignmentMatrix } from './alignment-matrix.ts';
import { criticalNodes } from './critical-nodes.ts';
import { CriticalNodesSheetFault, readCriticalNodesSheet } from './critical-nodes-sheet.ts';
import { csvExport, type ReleaseFile } from './csv-export.ts';
import { releaseDisclaimer } from './disclaimer.ts';
import { geojsonExport } from './geojson-export.ts';
import { jsonldExport } from './jsonld-export.ts';
import { releaseHeading } from './release-heading.ts';
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

const exists = async (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

/** Reads the sheet of the candidate nodes at its path, or gives null when the manifest names
 * none. */
const readSheet = async (path: string | null) => {
  if (path === null) return null;
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    throw new CriticalNodesSheetFault(`Cannot read the sheet of the candidate nodes ${path}.`);
  }
  return readCriticalNodesSheet(text);
};

/** Reads the public part of the record and writes one release folder, named by its date, in
 * `root`. The folder holds each file, then the file manifest with the checksum of each file. A
 * folder of the same date is never overwritten. A sheet of the candidate nodes that is refused
 * stops the release before it writes a file. */
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

  const sheet = await readSheet(manifest.criticalNodes);
  const record = await readReleaseRecord(db, { natoPair: manifest.showNatoPair });
  const disclaimer = releaseDisclaimer(record.disclaimer, manifest.contacts);
  const heading = releaseHeading(manifest, disclaimer);
  const preamble = `${heading.title}\n\n${disclaimer}`;
  const files: readonly ReleaseFile[] = [
    ...csvExport(record, preamble),
    alignmentMatrix(record, manifest.dateRules, preamble),
    criticalNodes(record, sheet, preamble),
    geojsonExport(record, heading),
    jsonldExport(record, heading, manifest.iriBase),
  ];

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
    showNatoPair: manifest.showNatoPair,
    dateRules: manifest.dateRules,
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
