// Writes both halves of the generated database types, and formats them. The formatter is part of
// generation, so the committed bytes are already the bytes the format check accepts.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { processDatabase } from 'kanel';
import { format, resolveConfig } from 'prettier';

import type { GeneratedFolders } from './kanel-configuration.ts';
import { committedFolders, kanelConfigurations } from './kanel-configuration.ts';

// Prettier reads its options from the folder of the file it formats. The anchor is a path inside
// the repository, so a scratch copy gets the options the committed folder gets.
const PRETTIER_ANCHOR = join(committedFolders.contract, 'anchor.ts');

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

/** Generates the contract and the base tables into `folders`, formatted and ready to commit. */
export const writeDatabaseTypes = async (folders: GeneratedFolders): Promise<void> => {
  for (const configuration of kanelConfigurations(folders)) await processDatabase(configuration);
  await formatFolder(folders.contract);
  await formatFolder(folders.baseTables);
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  await writeDatabaseTypes(committedFolders).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
