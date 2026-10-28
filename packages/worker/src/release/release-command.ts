import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { SiteReleaseFault } from '@gab/release/site-release-fault';
import { SiteFolderExists, writeSite } from '@gab/site/write-site';
import { Client } from 'pg';

import { appAddress } from '../address.ts';
import type { SubCommand } from '../command.ts';
import { CreditFault } from './credits.ts';
import { CriticalNodesSheetFault } from './critical-nodes-sheet.ts';
import { PreviousReleaseFault } from './previous-release.ts';
import { ReleaseFolderExists, writeRelease } from './release.ts';
import { readReleaseManifest, ReleaseManifestFault } from './release-manifest.ts';
import { inOneSnapshot, statementTimeout } from './snapshot.ts';
import { VolumeTableFault } from './volume-table.ts';

const USAGE =
  'Usage: pnpm worker release --manifest <file> --out <folder> [--previous <release folder>]';

// Departure: the role waits 30 seconds for one statement, and a release reads the whole record in
// one statement for each file. GAB_STATEMENT_TIMEOUT sets another value. The command runs on the
// machine of the operator, by hand.
const RELEASE_TIMEOUT = '10min';

const FLAGS = new Set(['--manifest', '--out', '--previous']);

const flagsOf = (
  args: readonly string[],
): { manifest: string; out: string; previous: string | null } | null => {
  if (args.length % 2 !== 0) return null;
  const given = new Map<string, string>();
  for (let at = 0; at < args.length; at += 2) {
    const [name, value] = [args[at] ?? '', args[at + 1] ?? ''];
    if (!FLAGS.has(name) || given.has(name) || value === '') return null;
    given.set(name, value);
  }
  const manifest = given.get('--manifest');
  const out = given.get('--out');
  return manifest === undefined || out === undefined
    ? null
    : { manifest, out, previous: given.get('--previous') ?? null };
};

/** Writes one release folder from the record, with the release manifest that the operator gives,
 * and the changelog since the previous release folder when the operator gives one. Then it builds
 * the application with the files of the release, and writes the site of the release beside it:
 * each page at its permanent address holds its text in the HTML.
 *
 * Each of these gives 2 with a message, and writes no release folder: a usage fault, a refused
 * manifest, a refused sheet of the candidate nodes, a volume table that cannot be read, a refused
 * previous release, a claim that cites a provider with no credit line, a release of the same date, and a site that cannot be built or written. A row
 * of the volume table that the release rejects is left out, and the command gives its line and the
 * reason. The command also gives the line of a row whose asset label names more than one entity:
 * that row joins no link. The paths of the sheet and of the volume table are relative to the
 * folder of the manifest. */
export const releaseCommand: SubCommand = async (args) => {
  const flags = flagsOf(args);
  if (flags === null) {
    console.error(USAGE);
    return 2;
  }
  let manifest;
  try {
    const read = readReleaseManifest(await readFile(flags.manifest, 'utf8'), new Date());
    const near = (path: string | null): string | null =>
      path === null ? null : resolve(dirname(flags.manifest), path);
    manifest = { ...read, criticalNodes: near(read.criticalNodes), volumes: near(read.volumes) };
  } catch (fault) {
    if (fault instanceof ReleaseManifestFault) console.error(fault.message);
    else console.error(`Cannot read the release manifest ${flags.manifest}.`);
    return 2;
  }

  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    await client.query(`SET statement_timeout = '${statementTimeout(RELEASE_TIMEOUT)}'`);
    // A stopped command drops its connection, and the server then ends the statement it runs. Else
    // the statement runs on to its end, and a new release shares the machine with it.
    await client.query(`SET client_connection_check_interval = '5s'`);
    const site = join(flags.out, `gab-site-${manifest.date}`);
    const written = await inOneSnapshot(client, () =>
      writeRelease(client, manifest, flags.out, flags.previous, (folder) =>
        writeSite(folder, site),
      ),
    );
    console.log(
      `The release ${manifest.version} is in ${written.folder}: ${String(written.entities)} ` +
        `entities, ${String(written.relations)} relations, ${String(written.claims)} claims. ` +
        `Its site is in ${site}.`,
    );
    for (const one of written.volumeRejections)
      console.error(`The volume table, line ${String(one.line)}: ${one.why}. The row is left out.`);
    for (const one of written.volumesUnjoined)
      console.error(`The volume table, line ${String(one.line)}: ${one.why}.`);
    if (written.gazetteOnly.length > 0)
      console.error(
        `These designations cite only the Federal Register, GovInfo or the Canada Gazette, so they count in no regime until they have the SDN or UK list line: ${written.gazetteOnly.join(', ')}.`,
      );
    return 0;
  } catch (fault) {
    if (!(
      fault instanceof ReleaseFolderExists ||
      fault instanceof CreditFault ||
      fault instanceof CriticalNodesSheetFault ||
      fault instanceof VolumeTableFault ||
      fault instanceof PreviousReleaseFault ||
      fault instanceof SiteFolderExists ||
      fault instanceof SiteReleaseFault
    ))
      throw fault;
    console.error(fault.message);
    return 2;
  } finally {
    await client.end();
  }
};
