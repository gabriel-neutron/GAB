import { readFile } from 'node:fs/promises';

import { Client } from 'pg';

import { appAddress } from '../address.ts';
import type { SubCommand } from '../command.ts';
import { writeRelease } from './release.ts';
import { readReleaseManifest, ReleaseManifestFault } from './release-manifest.ts';

const USAGE = 'Usage: pnpm worker release --manifest <file> --out <folder>';

// Departure: the role waits 30 seconds for one statement, and a release reads the whole record in
// one statement for each file. The command runs on the machine of the operator, by hand.
const RELEASE_TIMEOUT = '10min';

const flagsOf = (args: readonly string[]): { manifest: string; out: string } | null => {
  const [first, firstValue, second, secondValue, ...rest] = args;
  if (rest.length > 0 || firstValue === undefined || secondValue === undefined) return null;
  const given = new Map([
    [first, firstValue],
    [second, secondValue],
  ]);
  const manifest = given.get('--manifest');
  const out = given.get('--out');
  return manifest === undefined || out === undefined ? null : { manifest, out };
};

/** Writes one release folder from the record, with the release manifest that the operator
 * gives. A usage fault or a refused manifest gives 2, and nothing is read or written. */
export const releaseCommand: SubCommand = async (args) => {
  const flags = flagsOf(args);
  if (flags === null) {
    console.error(USAGE);
    return 2;
  }
  let manifest;
  try {
    manifest = readReleaseManifest(await readFile(flags.manifest, 'utf8'), new Date());
  } catch (fault) {
    if (fault instanceof ReleaseManifestFault) console.error(fault.message);
    else console.error(`Cannot read the release manifest ${flags.manifest}.`);
    return 2;
  }

  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    await client.query(`SET statement_timeout = '${RELEASE_TIMEOUT}'`);
    const written = await writeRelease(client, manifest, flags.out);
    console.log(
      `The release ${manifest.version} is in ${written.folder}: ${String(written.entities)} ` +
        `entities, ${String(written.relations)} relations, ${String(written.claims)} claims.`,
    );
    return 0;
  } finally {
    await client.end();
  }
};
