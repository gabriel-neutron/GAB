// Builds the file of the addresses of the documents that the report nodes cite, from the record,
// read only.
//
//   node tools/node-documents.ts   (with the variables of the record, as tools/node-audit.ts)
//
// The report node files name each document by its id only. The report shows the origin of a
// document of a party to the conflict, and the shared rule (@gab/release/party-origin) reads the
// address of the document. So this file gives the original address of each cited document. A
// restricted document or a document with no address gives no row. The file holds no rule and no
// party: the report applies the rule to the addresses.

import { readFileSync, writeFileSync } from 'node:fs';

import pg from 'pg';

import { connectionString } from './db-runtime.ts';

const DATA = new URL('../src/features/report/', import.meta.url);

/** The ids of the documents that the node files of the report cite, in a stable order. */
const citedDocuments = (...texts: readonly string[]): string[] =>
  [...new Set(texts.flatMap((text) => text.match(/doc_[0-9a-f]{12}/gu) ?? []))].sort();

const ids = citedDocuments(
  readFileSync(new URL('nodes-data.ts', DATA), 'utf8'),
  readFileSync(new URL('edges-data.ts', DATA), 'utf8'),
);
// Each session starts read only, so a write fails at the database.
const client = new pg.Client({
  connectionString: connectionString('app'),
  options: '-c default_transaction_read_only=on',
});
await client.connect();
try {
  const { rows } = await client.query<{ id: string; uri: string }>(
    `SELECT id, uri FROM public.documents
      WHERE id = ANY($1::text[]) AND uri IS NOT NULL AND NOT restricted ORDER BY id`,
    [ids],
  );
  const file = {
    builtOn: new Date().toISOString().slice(0, 10),
    documents: Object.fromEntries(rows.map((row) => [row.id, row.uri])),
  };
  writeFileSync(new URL('data/node-documents.json', DATA), JSON.stringify(file, null, 2) + '\n');
  console.log(`${String(rows.length)} of ${String(ids.length)} cited documents have an address.`);
} finally {
  await client.end();
}
