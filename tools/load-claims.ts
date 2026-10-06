// Loads the report claims as gabriel_app, one report document for each kept block:
//
//   pnpm load:claims <folder> --map <sources-map.csv> --retrieved-at <YYYY-MM-DD>
//
// The loader writes no rating, no originator, no citation and no proposal, and it calls no model.
// A block becomes a Markdown document that names the document ids of its sources, and the one
// door that stores bytes takes it. Only a document that this run stored gets an extraction job,
// and the extractor proposes later.
//
// The claims files are private. The loader reads them from the folder that it is given and
// copies nothing into the repository.

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { openStore, putObject } from '@gab/store';
import { Pool } from 'pg';

import { checkedDay, storeBytes, type StoredFile, type StoreResult } from '@gab/worker/ingest';
import { claimDocument, parseClaims, type ClaimBlock } from '@gab/worker/report-claims';
import { rowsOfCsv } from './csv.ts';
import { connectionString } from './db-runtime.ts';
import type { Ask } from './probe.ts';

type Fields = Readonly<Record<string, string>>;

const MAP_COLUMNS = ['id', 'document_id', 'claim_ids'] as const;

// The files of the operator that hold the final claims. A draft beside them is never loaded.
const CLAIMS_FILE = /-final\.md$/i;

// ------------------------------------------------------------------------------ the plan -------

/** The claim ids of one map cell. The cell is raw text, so each usual separator splits it. */
export const claimIdsOf = (cell: string): readonly string[] =>
  cell.split(/[\s,;]+/u).filter((id) => id !== '');

export interface PlannedClaim {
  readonly block: ClaimBlock;
  readonly documentIds: readonly string[];
  /** The S-ids that name the claim and hold no document id. */
  readonly unmapped: readonly string[];
  /** True when no S-id names the claim. */
  readonly noSource: boolean;
  readonly bytes: Uint8Array;
}

export interface ClaimPlan {
  readonly claims: readonly PlannedClaim[];
  /** The claim ids of the map that no block has. */
  readonly unknownClaims: readonly string[];
}

/** Each block with the sources that the map gives it, read in reverse, and the bytes it becomes. */
export const planClaims = (blocks: readonly ClaimBlock[], map: readonly Fields[]): ClaimPlan => {
  const naming = new Map<string, { documentIds: string[]; unmapped: string[] }>();
  for (const row of map) {
    const sourceId = row['id'] ?? '';
    const documentId = row['document_id'] ?? '';
    for (const claimId of claimIdsOf(row['claim_ids'] ?? '')) {
      const held = naming.get(claimId) ?? { documentIds: [], unmapped: [] };
      if (documentId === '') held.unmapped.push(sourceId);
      else held.documentIds.push(documentId);
      naming.set(claimId, held);
    }
  }
  const encoder = new TextEncoder();
  const claims = blocks.map((block) => {
    const held = naming.get(block.claimId);
    const documentIds = [...new Set(held?.documentIds ?? [])].sort();
    return {
      block,
      documentIds,
      unmapped: [...new Set(held?.unmapped ?? [])].sort(),
      noSource: held === undefined,
      bytes: encoder.encode(claimDocument(block, documentIds)),
    };
  });
  const present = new Set(blocks.map((block) => block.claimId));
  return {
    claims,
    unknownClaims: [...naming.keys()].filter((id) => !present.has(id)).sort(),
  };
};

// ------------------------------------------------------------------------------ the load -------

export type ClaimStatus = 'stored' | 'known' | 'deleted' | 'changed' | 'refused';
const STATUSES: readonly ClaimStatus[] = ['stored', 'known', 'deleted', 'changed', 'refused'];

export interface ClaimLine {
  readonly claimId: string;
  readonly file: string;
  readonly firstLine: number;
  readonly lastLine: number;
  readonly status: ClaimStatus;
  readonly flags: readonly ('no source' | 'unmapped')[];
  readonly detail: string;
  readonly documentId?: string;
}

export interface ClaimReport {
  readonly lines: readonly ClaimLine[];
  readonly unknownClaims: readonly string[];
}

export interface ClaimDoor {
  readonly ask: Ask;
  readonly store: (file: StoredFile) => Promise<StoreResult>;
}

const firstLine = (error: unknown): string =>
  error instanceof Error ? (error.message.split('\n')[0] ?? 'refused') : 'refused';

const heldReports = (rows: readonly unknown[]): readonly { id: string; sha256: string }[] =>
  rows.flatMap((row) =>
    typeof row === 'object' &&
    row !== null &&
    'id' in row &&
    'sha256' in row &&
    typeof row.id === 'string' &&
    typeof row.sha256 === 'string'
      ? [{ id: row.id, sha256: row.sha256 }]
      : [],
  );

const notes = (claim: PlannedClaim): string[] => [
  ...(claim.unmapped.length > 0 ? [`no document id for ${claim.unmapped.join(', ')}`] : []),
  ...(claim.block.missing.length > 0 ? [`missing ${claim.block.missing.join(', ')}`] : []),
  ...(claim.block.unknown.length > 0 ? [`unknown field ${claim.block.unknown.join(', ')}`] : []),
];

type Outcome = Pick<ClaimLine, 'status' | 'detail' | 'documentId'>;

// A claim id names one report document. Bytes that differ from the held ones are a change that
// the operator decides, so they are never stored beside the old ones.
const loadOne = async (
  claim: PlannedClaim,
  door: ClaimDoor,
  retrievedAt: string,
): Promise<Outcome> => {
  const { block } = claim;
  if (block.deleted) return { status: 'deleted', detail: `deleted: ${block.reason ?? ''}` };

  const sha256 = createHash('sha256').update(claim.bytes).digest('hex');
  const held = heldReports(
    await door.ask(
      "SELECT id, sha256 FROM public.documents WHERE kind = 'report' AND title = $1::text",
      [block.claimId],
    ),
  );
  const same = held.find((row) => row.sha256 === sha256);
  if (same !== undefined) return { status: 'known', detail: '', documentId: same.id };
  if (held.length > 0)
    return {
      status: 'changed',
      detail: `${held.map((row) => row.id).join(', ')} holds other bytes for this claim id`,
    };

  const stored = await door.store({
    bytes: claim.bytes,
    fileName: `${block.claimId}.md`,
    title: block.claimId,
    kind: 'report',
    retrievedAt,
    uri: null,
    providerId: null,
    costEur: null,
  });
  if (stored.status === 'known') return { status: 'known', detail: '', documentId: stored.id };
  try {
    await door.ask("SELECT public.enqueue_job($1::text, 'extract_text')", [stored.id]);
  } catch (error) {
    return {
      status: 'refused',
      detail: `the document is stored, and its job is refused: ${firstLine(error)}`,
      documentId: stored.id,
    };
  }
  return { status: 'stored', detail: '', documentId: stored.id };
};

/** Loads each planned block through the doors, in the order of the plan, and reports each one. */
export const loadClaims = async (
  plan: ClaimPlan,
  door: ClaimDoor,
  retrievedAt: string,
): Promise<ClaimReport> => {
  const day = checkedDay(retrievedAt);
  const lines: ClaimLine[] = [];
  for (const claim of plan.claims) {
    let outcome: Outcome;
    try {
      outcome = await loadOne(claim, door, day);
    } catch (error) {
      outcome = { status: 'refused', detail: firstLine(error) };
    }
    // A deleted block is not stored, so its sources and its fields are not a fault of the load.
    const kept = !claim.block.deleted;
    const flags: ('no source' | 'unmapped')[] = [];
    if (kept && claim.noSource) flags.push('no source');
    if (kept && claim.unmapped.length > 0) flags.push('unmapped');
    const detail = [outcome.detail, ...(kept ? notes(claim) : [])]
      .filter((part) => part !== '')
      .join('; ');
    lines.push({
      claimId: claim.block.claimId,
      file: claim.block.file,
      firstLine: claim.block.firstLine,
      lastLine: claim.block.lastLine,
      flags,
      ...outcome,
      detail,
    });
  }
  return { lines, unknownClaims: plan.unknownClaims };
};

// ------------------------------------------------------------------------------ the report -----

/** The counts per status, then one line for each claim id of the map that no block has. */
export const summaryLines = (
  lines: readonly Pick<ClaimLine, 'status'>[],
  unknownClaims: readonly string[],
): readonly string[] => [
  STATUSES.map(
    (status) => `${status} ${lines.filter((line) => line.status === status).length}`,
  ).join(', '),
  ...unknownClaims.map((id) => `unknown claim  ${id}`),
];

const lineOf = (line: ClaimLine): string =>
  [
    line.status.padEnd(8),
    line.claimId,
    `${line.file}:${line.firstLine}-${line.lastLine}`,
    line.documentId ?? '',
    ...line.flags.map((flag) => `[${flag}]`),
    line.detail,
  ]
    .filter((part) => part !== '')
    .join('  ');

// ------------------------------------------------------------------------------ the command ----

const USAGE =
  'Usage: pnpm load:claims <folder> --map <sources-map.csv> --retrieved-at <YYYY-MM-DD>';

/** The folder, the map and the day of a run. It throws before any read when an argument is wrong. */
export const parseLoadArguments = (
  args: readonly string[],
): { readonly folder: string; readonly map: string; readonly retrievedAt: string } => {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    strict: true,
    options: { map: { type: 'string' }, 'retrieved-at': { type: 'string' } },
  });
  const retrievedAt = checkedDay(values['retrieved-at']);
  const [folder] = positionals;
  if (folder === undefined || positionals.length !== 1)
    throw new Error('Name one folder of claims files.');
  if (values.map === undefined || values.map === '') throw new Error('--map is required.');
  return { folder, map: values.map, retrievedAt };
};

const readPlan = async (folder: string, mapFile: string): Promise<ClaimPlan> => {
  const map = rowsOfCsv(await readFile(mapFile, 'utf8'));
  const [first] = map;
  const missing = MAP_COLUMNS.filter((name) => first !== undefined && !(name in first));
  if (missing.length > 0) throw new Error(`The map has no column ${missing.join(', ')}.`);
  const names = (await readdir(folder, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && CLAIMS_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (names.length === 0) throw new Error(`The folder holds no file named *-final.md.`);
  const blocks: ClaimBlock[] = [];
  for (const name of names)
    blocks.push(...parseClaims(await readFile(join(folder, name), 'utf8'), name));
  console.log(`${names.length} files read: ${names.join(', ')}`);
  return planClaims(blocks, map);
};

const main = async (): Promise<number> => {
  let run;
  try {
    run = parseLoadArguments(argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The arguments are not usable.');
    console.error(USAGE);
    return 2;
  }
  const plan = await readPlan(run.folder, run.map);

  const pool = new Pool({ connectionString: connectionString('app') });
  const raw = openStore();
  try {
    const report = await loadClaims(
      plan,
      {
        ask: async (text, values) =>
          (
            await pool.query<Record<string, unknown>>(
              text,
              values === undefined ? undefined : [...values],
            )
          ).rows,
        store: async (file) => {
          const session = await pool.connect();
          try {
            return await storeBytes({ put: (object) => putObject(raw, object) }, session, file);
          } finally {
            session.release();
          }
        },
      },
      run.retrievedAt,
    );
    for (const line of report.lines) console.log(lineOf(line));
    for (const line of summaryLines(report.lines, report.unknownClaims)) console.log(line);
    return report.lines.some((line) => line.status === 'refused' || line.status === 'changed')
      ? 1
      : 0;
  } finally {
    await pool.end();
  }
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  });
}
