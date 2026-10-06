// Loads the approved list of adverse predicates from one CSV file, as gabriel_app. One run is one
// load: the door gives each row the same load id, never changes an earlier load, and refuses a
// predicate outside the closed list of its subject kind. Code reads the last load.

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { z } from 'zod';

import { connectionString } from './db-runtime.ts';
import { rowsOfCsv } from './load-trust-lists.ts';
import type { Ask } from './probe.ts';

// A blank field is absent. The door reads an absent field as NULL.
const optional = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.string().optional(),
);

const ruleRows = z
  .array(
    z.object({
      row_kind: z.enum(['keyword', 'key']),
      subject_kind: z.string().min(1),
      predicate: z.string().min(1),
      class: z.string().min(1),
      lang: optional,
      keyword: optional,
      key: optional,
    }),
  )
  .min(1);

const loaded = z.array(z.object({ id: z.uuid() })).length(1);

/** Loads the rules of one CSV file through the door, and returns the id of the load. */
export const loadAdversePredicates = async (file: string, ask: Ask): Promise<string> => {
  const rows = ruleRows.parse(rowsOfCsv(await readFile(file, 'utf8'), ','));
  const [row] = loaded.parse(
    await ask('SELECT public.load_adverse_predicates($1, $2::jsonb)::text AS id', [
      basename(file),
      JSON.stringify(rows),
    ]),
  );
  if (row === undefined) throw new Error('the door loaded the rules and returned no id');
  return row.id;
};

const main = async (): Promise<void> => {
  const file = argv[2];
  if (file === undefined || file === '') {
    console.error('Usage: pnpm load:adverse-predicates <approved CSV file>');
    process.exitCode = 2;
    return;
  }
  const client = new Client({ connectionString: connectionString('app') });
  await client.connect();
  try {
    const id = await loadAdversePredicates(file, async (text, values) => {
      const found = await client.query<Record<string, unknown>>(
        text,
        values === undefined ? undefined : [...values],
      );
      return found.rows;
    });
    console.log(`loaded ${basename(file)} as load ${id}`);
  } finally {
    await client.end();
  }
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
