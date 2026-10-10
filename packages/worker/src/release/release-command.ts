import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { Client } from 'pg';

import { appAddress } from '../address.ts';
import type { SubCommand } from '../command.ts';
import { CriticalNodesSheetFault } from './critical-nodes-sheet.ts';
import { PreviousReleaseFault } from './previous-release.ts';
import { ReleaseFolderExists, writeRelease } from './release.ts';
import { readReleaseManifest, ReleaseManifestFault } from './release-manifest.ts';
import { inOneSnapshot } from './snapshot.ts';

const USAGE =
  'Usage: pnpm worker release --manifest <file> --out <folder> [--previous <release folder>]';

// Departure: the role waits 30 seconds for one statement, and a release reads the whole record in
// one statement for each file. The command runs on the machine of the operator, by hand.
const RELEASE_TIMEOUT = '10min';

const FLAGS = new Set(['--manifest', '--out', '--previous']);

const flagsOf = (
  args: readonly string[],
): { manifest: string; out: string; previous: string | null } | null => {
  if (args.length % 2 !== 0) return null;
  const given = new Map<string, string>();
  for (let at = 0; at < args.length; at += 2) {
    const [name, value] = [args[at] ?? '', args[at + 1] ?? ''];
    if (!FLAGS.has(name) || given.has(name)) return null;
    given.set(name, value);
  }
  const manifest = given.get('--manifest');
  const out = given.get('--out');
  return manifest === undefined || out === undefined
    ? null
    : { manifest, out, previous: given.get('--previous') ?? null };
};

/** Writes one release folder from the record, with the release manifest that the operator
 * gives, and the changelog since the previous release folder when the operator gives one. A usage
 * fault, a refused manifest, a refused sheet of the candidate nodes, a refused previous release or
 * a release of the same date gives 2, and nothing is written. The path of the sheet is relative to the folder
 * of the manifest. */
export const releaseCommand: SubCommand = async (args) => {
  const flags = flagsOf(args);
  if (flags === null) {
    console.error(USAGE);
    return 2;
  }
  let manifest;
  try {
    const read = readReleaseManifest(await readFile(flags.manifest, 'utf8'), new Date());
    const sheet = read.criticalNodes;
    manifest = {
      ...read,
      criticalNodes: sheet === null ? null : resolve(dirname(flags.manifest), sheet),
    };
  } catch (fault) {
    if (fault instanceof ReleaseManifestFault) console.error(fault.message);
    else console.error(`Cannot read the release manifest ${flags.manifest}.`);
    return 2;
  }

  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    await client.query(`SET statement_timeout = '${RELEASE_TIMEOUT}'`);
    const written = await inOneSnapshot(client, () =>
      writeRelease(client, manifest, flags.out, flags.previous),
    );
    console.log(
      `The release ${manifest.version} is in ${written.folder}: ${String(written.entities)} ` +
        `entities, ${String(written.relations)} relations, ${String(written.claims)} claims.`,
    );
    return 0;
  } catch (fault) {
    if (!(
      fault instanceof ReleaseFolderExists ||
      fault instanceof CriticalNodesSheetFault ||
      fault instanceof PreviousReleaseFault
    ))
      throw fault;
    console.error(fault.message);
    return 2;
  } finally {
    await client.end();
  }
};
