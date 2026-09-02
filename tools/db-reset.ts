import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { applyRerunnableFiles } from './db-apply.ts';
import { runOrderedFiles } from './db-migrate.ts';
import { compose, waitForDatabase } from './db-runtime.ts';

/** Destroys the two volumes and reaches the current schema and the private bucket from zero. */
export const resetFromZero = async (): Promise<void> => {
  await compose(['down', '-v']);
  await compose(['up', '-d']);
  await waitForDatabase();
  await runOrderedFiles();
  await applyRerunnableFiles();
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  await resetFromZero().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
