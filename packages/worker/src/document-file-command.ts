import { openReadStore } from '@gab/store/bucket';
import { readObject } from '@gab/store/reading';
import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { writeDocumentFile } from './document-file.ts';

const USAGE = 'Usage: pnpm worker document-file <document id> <out file>';

/** Writes the bytes of one stored document to a new local file, and prints their SHA-256. It
 * writes nothing to the database or the store. It gives 1 when the file is not written, and 2 for a
 * usage fault. */
export const documentFileCommand: SubCommand = async (args) => {
  const [document, out, ...rest] = args;
  if (document === undefined || out === undefined || rest.length > 0) {
    console.error(USAGE);
    return 2;
  }

  const store = openReadStore();
  const client = new Client({ connectionString: appAddress() });
  try {
    await client.connect();
    const sha256 = await writeDocumentFile(
      { db: client, read: (key) => readObject(store, key) },
      document,
      out,
    );
    console.log(`Wrote document ${document} to ${out}. SHA-256 ${sha256}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The file was not written.');
    return 1;
  } finally {
    await client.end();
    store.client.destroy();
  }
};
