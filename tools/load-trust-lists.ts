// Loads the approved trust lists into the database, as gabriel_app. The folder holds
// APPROVALS.md, belligerents.csv, sanctioned-hosts.csv and register-cards/<issuer>.yaml.
//
// The load of an approved file is the approval of the operator. A file is read only when
// APPROVALS.md names it and holds the hash of its bytes, so a changed file needs a new row. The
// loader reads the one folder that it is given, and it copies nothing out of it.

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import { connectionString } from './db-runtime.ts';
import type { Ask } from './probe.ts';

export interface LoadReport {
  readonly file: string;
  readonly status: 'loaded' | 'unchanged' | 'refused';
  readonly detail: string;
}

interface Approval {
  readonly date: string;
  readonly file: string;
  readonly sha256: string;
  readonly reason: string;
}

const SHA = /^[0-9a-f]{64}$/;

// The rows of the table in APPROVALS.md. The header and the separator are not rows.
const approvalsOf = (markdown: string): readonly Approval[] =>
  markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|'))
    .map((line) =>
      line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.length >= 4 && SHA.test(cells[2] ?? ''))
    .map(([date, file, sha256, reason]) => ({
      date: date ?? '',
      file: file ?? '',
      sha256: sha256 ?? '',
      reason: reason ?? '',
    }));

// A semicolon-separated file, UTF-8, with a BOM allowed. A field in double quotes may hold a
// semicolon, a line break or a doubled quote. Another list can name another separator.
export const rowsOfCsv = (text: string, separator = ';'): readonly Record<string, string>[] => {
  const body = text.codePointAt(0) === 0xfeff ? text.slice(1) : text;
  const table: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let at = 0; at < body.length; at += 1) {
    const char = body[at] ?? '';
    if (quoted) {
      if (char === '"' && body[at + 1] === '"') {
        field += '"';
        at += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && body[at + 1] === '\n') at += 1;
      row.push(field);
      table.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    table.push(row);
  }
  const [header = [], ...lines] = table.filter((cells) => cells.some((cell) => cell.trim() !== ''));
  const names = header.map((name) => name.trim());
  return lines.map((cells) =>
    Object.fromEntries(names.map((name, index) => [name, (cells[index] ?? '').trim()])),
  );
};

// A blank optional field is absent. The door reads an absent field as NULL.
const optional = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().nullable(),
);

const belligerentRows = z.array(
  z.object({ code: z.string().min(1), name: z.string().min(1), conflict: z.string().min(1) }),
);

const hostRows = z.array(
  z.object({
    outlet: z.string().min(1),
    host_or_account: z.string().min(1),
    regime: z.string().min(1),
    list_entry_id: z.string().min(1),
    list_url: z.string().min(1),
    outlet_registration: optional.optional(),
    entry_registration: optional.optional(),
    listed_on: optional.optional(),
    checked_until: optional.optional(),
  }),
);

const cardRow = z
  .object({
    issuer: z.string().min(1),
    display_name: z.string().optional(),
    kind: z.string().optional(),
    hosts: z.array(z.string().min(1)).min(1),
    tls_names: z.array(z.string()).optional(),
    url_patterns: z.array(z.string()).optional(),
    record_kinds: z.array(z.string()).optional(),
    fields: z.array(z.object({ name: z.string().min(1), declarant: z.string() })).optional(),
    identifier_types: z.array(z.string()).optional(),
    terms_of_use: z.string().optional(),
    jurisdiction: z.string().optional(),
    sanctions_regime: z.string().optional(),
  })
  .strict();

const rowsOf = (file: string, text: string): readonly unknown[] => {
  if (file === 'belligerents.csv') return belligerentRows.parse(rowsOfCsv(text));
  if (file === 'sanctioned-hosts.csv') return hostRows.parse(rowsOfCsv(text));
  return [cardRow.parse(parseYaml(text))];
};

const door = z.array(z.object({ loaded: z.number().nullable() }));

const loadOne = async (
  folder: string,
  file: string,
  approvals: readonly Approval[],
  ask: Ask,
): Promise<LoadReport> => {
  const bytes = await readFile(join(folder, file));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const named = approvals.filter((approval) => approval.file === file);
  if (named.length === 0)
    return { file, status: 'refused', detail: 'APPROVALS.md has no row for this file' };
  const approval = named
    .filter((row) => row.sha256 === sha256)
    .sort((left, right) => right.date.localeCompare(left.date))[0];
  if (approval === undefined)
    return {
      file,
      status: 'refused',
      detail: 'the hash of the file is not the hash in any row of APPROVALS.md',
    };

  try {
    const rows = rowsOf(file, bytes.toString('utf8'));
    const [held] = door.parse(
      await ask('SELECT public.load_trust_list($1, $2, $3::date, $4, $5::jsonb) AS loaded', [
        file,
        sha256,
        approval.date,
        approval.reason,
        JSON.stringify(rows),
      ]),
    );
    return held?.loaded === null || held?.loaded === undefined
      ? { file, status: 'unchanged', detail: 'the same bytes were the last load' }
      : { file, status: 'loaded', detail: `${held.loaded} rows` };
  } catch (error) {
    return {
      file,
      status: 'refused',
      detail: error instanceof Error ? (error.message.split('\n')[0] ?? 'refused') : 'refused',
    };
  }
};

/** Loads each approved file of a folder through the door, and reports what happened to each. */
export const loadTrustLists = async (folder: string, ask: Ask): Promise<readonly LoadReport[]> => {
  const approvals = approvalsOf(await readFile(join(folder, 'APPROVALS.md'), 'utf8'));
  const held = new Set(await readdir(folder));
  const cards = held.has('register-cards')
    ? (await readdir(join(folder, 'register-cards')))
        .filter((name) => name.endsWith('.yaml'))
        .sort()
        .map((name) => `register-cards/${name}`)
    : [];
  const files = [
    ...['belligerents.csv', 'sanctioned-hosts.csv'].filter((name) => held.has(name)),
    ...cards,
  ];

  const reports: LoadReport[] = [];
  for (const file of files) reports.push(await loadOne(folder, file, approvals, ask));
  return reports;
};

const main = async (): Promise<void> => {
  const folder = argv[2];
  if (folder === undefined || folder === '') {
    console.error('Usage: pnpm load:trust-lists <approved folder>');
    process.exitCode = 2;
    return;
  }
  const client = new Client({ connectionString: connectionString('app') });
  await client.connect();
  try {
    const reports = await loadTrustLists(folder, async (text, values) => {
      const found = await client.query<Record<string, unknown>>(
        text,
        values === undefined ? undefined : [...values],
      );
      return found.rows;
    });
    for (const report of reports)
      console.log(`${report.status.padEnd(9)} ${report.file}  ${report.detail}`);
    if (reports.some((report) => report.status === 'refused')) process.exitCode = 1;
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
