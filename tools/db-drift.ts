// Departure: the check reaches the test database and never the record. The check applies the
// re-runnable SQL first, so the measure is the SQL this repository holds, and that step writes
// rows: the seed file adds rows and updates entity types. Build the test database again with
// `pnpm db:reset` before the check.

// Departure: the exit code of the generator is not the measure. It stops at random on this
// machine, three runs in six, and the output it wrote was correct and identical every time.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { applyRerunnableFiles } from './db-apply.ts';
import { orderedFileNotRun } from './db-migrate.ts';
import { committedFolder } from './kanel-configuration.ts';
import { generatedFiles, writeDatabaseTypes } from './db-types.ts';

const SCRATCH = join(import.meta.dirname, '..', 'node_modules', '.cache', 'db-types', 'contract');

const DATABASE = 'gabriel_test';

/** One file where the schema and the repository disagree, and the shape of the disagreement. */
export interface Drift {
  readonly path: string;
  readonly reason: string;
  readonly excerpt: string;
}

const lineDifference = (committed: string, regenerated: string): string => {
  const held = committed.split('\n');
  const fresh = regenerated.split('\n');
  const differs = held.findIndex((line, index) => fresh[index] !== line);
  const at = differs === -1 ? Math.min(held.length, fresh.length) : differs;
  return [
    `  line ${at + 1}`,
    `  committed:   ${held[at] ?? '(the file ends)'}`,
    `  regenerated: ${fresh[at] ?? '(the file ends)'}`,
  ].join('\n');
};

const compareFolder = async (committed: string, regenerated: string): Promise<Drift | null> => {
  const held = await generatedFiles(committed);
  const fresh = await generatedFiles(regenerated);

  for (const name of fresh)
    if (!held.includes(name))
      return {
        path: join(committed, name),
        reason: 'the schema produces this file and the repository does not hold it',
        excerpt: '',
      };

  for (const name of held) {
    if (!fresh.includes(name))
      return {
        path: join(committed, name),
        reason: 'the repository holds this file and the schema no longer produces it',
        excerpt: '',
      };

    const before = await readFile(join(committed, name));
    const after = await readFile(join(regenerated, name));
    if (!before.equals(after))
      return {
        path: join(committed, name),
        reason: 'the bytes of this file differ from the bytes the schema produces',
        excerpt: lineDifference(before.toString('utf8'), after.toString('utf8')),
      };
  }

  return null;
};

/** The first committed file that disagrees with the SQL this repository holds, or null. */
export const databaseTypeDrift = async (): Promise<Drift | null> => {
  const pending = await orderedFileNotRun(DATABASE);
  if (pending !== null)
    return {
      path: join('db', 'migrations', pending),
      reason:
        'the test database never ran this ordered file, so it is not the schema. Run `pnpm db:reset`',
      excerpt: '',
    };

  await applyRerunnableFiles(DATABASE);
  await writeDatabaseTypes(SCRATCH, DATABASE);
  return compareFolder(committedFolder, SCRATCH);
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const found = await databaseTypeDrift();
    if (found === null) {
      console.log('no drift');
    } else {
      console.error(`The repository drifted from the SQL it holds.\n  ${found.path}`);
      console.error(`  ${found.reason}`);
      if (found.excerpt !== '') console.error(found.excerpt);
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
}
