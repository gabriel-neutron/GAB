// Writes the generated types of the api schema, and formats them. The formatter is part of
// generation, so the committed bytes are already the bytes the format check accepts.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { processDatabase } from 'kanel';
import { format, resolveConfig } from 'prettier';

import { committedFolder, kanelConfiguration } from './kanel-configuration.ts';
import { chosenDatabase, type DatabaseName } from './test-database.ts';

// Prettier reads its options from the folder of the file it formats. The anchor is a path inside
// the repository, so a scratch copy gets the options the committed folder gets.
const PRETTIER_ANCHOR = join(committedFolder, 'anchor.ts');

/** Each file of one generated folder, as a path relative to that folder, sorted. */
export const generatedFiles = async (folder: string): Promise<readonly string[]> => {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)))
    .sort();
};

const formatFolder = async (folder: string): Promise<void> => {
  const options = (await resolveConfig(PRETTIER_ANCHOR)) ?? {};
  for (const name of await generatedFiles(folder)) {
    const path = join(folder, name);
    const written = await readFile(path, 'utf8');
    await writeFile(path, await format(written, { ...options, parser: 'typescript' }));
  }
};

/** Generates the types of the api schema of `database` into `folder`, formatted and ready to commit. */
export const writeDatabaseTypes = async (folder: string, database: DatabaseName): Promise<void> => {
  await processDatabase(kanelConfiguration(folder, database));
  await formatFolder(folder);
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  await writeDatabaseTypes(committedFolder, chosenDatabase(process.env)).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
