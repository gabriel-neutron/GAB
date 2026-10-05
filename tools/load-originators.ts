// Loads the originators of the operator source list, with the operator letter of each, as
// gabriel_app. Two runs make one load:
//
//   pnpm load:originators <sources.csv> --propose-map <data folder> --out <folder>
//   pnpm load:originators <sources.csv> --map <originators.csv> --data <data folder> --out <folder>
//
// The first run proposes a canonical id and a file for each row, and loads nothing. The operator
// reads the proposal and saves it under another name. The second run loads only that file.
//
// The list and its files are private. The loader reads them from the folders that it is given,
// copies nothing into the repository, and refuses to write its output inside the working folder.

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { argv, cwd } from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { openStore, putObject } from '@gab/store';
import { Pool } from 'pg';

import { storeBytes, type StoredFile, type StoreResult } from '@gab/worker/ingest';
import { csvOfRows, rowsOfCsv } from './csv.ts';
import { connectionString } from './db-runtime.ts';
import type { Ask } from './probe.ts';

type Fields = Readonly<Record<string, string>>;

// External constraint: the closed list of schemes that the database seeds, without the scheme of
// an own algorithm, which no source list holds.
const SCHEMES: ReadonlySet<string> = new Set([
  'host',
  'telegram',
  'x',
  'vk',
  'substack',
  'livejournal',
]);
const KINDS: ReadonlySet<string> = new Set(['state_body', 'organisation', 'person', 'account']);
const LETTER = /^[A-F]$/;
const CANONICAL_SHAPE = /^[a-z]+:[^\s]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// External constraint: the check of the originator table refuses these hosts, because each one
// carries the words of others and none of them is an originator.
const CARRIERS: ReadonlySet<string> = new Set([
  'substack.com',
  't.me',
  'vk.com',
  'x.com',
  'twitter.com',
  'archive.today',
  'tgstat.ru',
  'sanctions.lursoft.lv',
  'audit-it.ru',
]);
const HOST_SHAPE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const STATE_HOST = /(^|\.)(gov|mil)(\.[a-z]{2,3})?$/;

const LICENCE_NOTE =
  'licence_rediffusion is not loaded: the column waits for its own ticket, and no row sets it.';

// ------------------------------------------------------------------------------ the proposal ---

export interface ProposedRow {
  readonly id: string;
  readonly canonical_id: string;
  readonly kind: string;
  readonly path: string;
  readonly match_reason: string;
}

interface Canonical {
  readonly id: string;
  readonly kind: string;
  readonly reason: string;
}

const absent = (reason: string): Canonical => ({ id: '', kind: '', reason });

const hostOf = (address: string): URL | undefined => {
  try {
    return new URL(address);
  } catch {
    return undefined;
  }
};

const canonicalOf = (address: string): Canonical => {
  if (address === '') return absent('no address, so no canonical id');
  const url = hostOf(address);
  if (url === undefined) return absent('the address cannot be read');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  const author = /^([a-z0-9-]+)\.(substack|livejournal)\.com$/.exec(host);
  if (author !== null)
    return {
      id: `${author[2] ?? ''}:${author[1] ?? ''}`,
      kind: 'account',
      reason: `the author on the carrier ${author[2] ?? ''}`,
    };
  if (host === 'livejournal.com') {
    const named = /^\/users\/([^/]+)/.exec(url.pathname);
    if (named !== null)
      return { id: `livejournal:${named[1] ?? ''}`, kind: 'account', reason: 'the author path' };
  }
  if (['t.me', 'x.com', 'twitter.com', 'vk.com'].includes(host))
    return absent(`the account id on ${host} is a number, and only a lookup gives it`);
  if (CARRIERS.has(host)) return absent(`${host} is a carrier and never an originator`);
  if (!HOST_SHAPE.test(host)) return absent(`${host} is not a host name`);
  return {
    id: `host:${host}`,
    kind: STATE_HOST.test(host) ? 'state_body' : 'organisation',
    reason: 'the issuer host of the address',
  };
};

const normalised = (text: string): string =>
  text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const decoded = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

const stemOf = (name: string): string => name.slice(0, name.length - extname(name).length);

// One rule at a time, in this order. A rule that finds two files finds none, because a guess
// between two files is a name used as a key.
const fileOf = (row: Fields, files: readonly string[]): { path: string; reason: string } => {
  const id = row['id'] ?? '';
  const url = hostOf(row['url'] ?? '');
  const last = url === undefined ? '' : decoded(basename(url.pathname));
  const title = normalised(row['title'] ?? '');
  const idPrefix = new RegExp(`^${id.replace(/[^A-Za-z0-9]/g, '\\$&')}([^A-Za-z0-9]|$)`, 'i');
  const rules: readonly { reason: string; test: (name: string) => boolean }[] = [
    {
      reason: 'the file name is the last segment of the address',
      test: (name) => last !== '' && extname(last) !== '' && name === last,
    },
    {
      reason: 'the file name starts with the id',
      test: (name) => id !== '' && idPrefix.test(name),
    },
    {
      reason: 'the file name is the title',
      test: (name) => title !== '' && normalised(stemOf(name)) === title,
    },
  ];
  for (const rule of rules) {
    const hits = files.filter((path) => rule.test(basename(path)));
    if (hits.length === 1) return { path: hits[0] ?? '', reason: rule.reason };
    if (hits.length > 1) return { path: '', reason: `${hits.length} files match: ${rule.reason}` };
  }
  return { path: '', reason: 'no file matches' };
};

/** One proposed row for each source row. It reads only the row and the list of file names. */
export const proposeMap = (
  rows: readonly Fields[],
  files: readonly string[],
): readonly ProposedRow[] =>
  rows.map((row) => {
    const canonical = canonicalOf(row['url'] ?? '');
    const file = fileOf(row, files);
    return {
      id: row['id'] ?? '',
      canonical_id: canonical.id,
      kind: canonical.kind,
      path: file.path,
      match_reason: `canonical id: ${canonical.reason}; file: ${file.reason}`,
    };
  });

// ------------------------------------------------------------------------------ the plan -------

export interface PlannedRow {
  readonly id: string;
  readonly letter: string;
  readonly title: string;
  readonly url: string;
  readonly name: string;
  readonly consulted: string;
  readonly canonicalId: string;
  readonly kind: string;
  readonly path: string;
}

export interface RefusedRow {
  readonly id: string;
  readonly detail: string;
}

// The first fault of a row, or nothing when the row may reach a door.
const faultOf = (row: Fields, entry: Fields | undefined, held: number): string | undefined => {
  const canonicalId = entry?.['canonical_id'] ?? '';
  const scheme = canonicalId.split(':')[0] ?? '';
  const kind = entry?.['kind'] ?? '';
  const letter = row['admiralty'] ?? '';
  if ((row['id'] ?? '') === '') return 'the id of the row is blank';
  if (held > 1) return 'the id appears on more than one row';
  if (entry === undefined) return 'the checked map has no row for this id';
  if (canonicalId === '') return 'the checked map holds no canonical id for this row';
  if (!CANONICAL_SHAPE.test(canonicalId))
    return 'the value is not a canonical id: a name is never a key';
  if (!SCHEMES.has(scheme)) return `the scheme "${scheme}" is not in the closed list of schemes`;
  if (!KINDS.has(kind)) return `the kind "${kind}" is not one of ${[...KINDS].join(', ')}`;
  if (!LETTER.test(letter)) return `the letter "${letter}" is not one letter, A to F`;
  if ((row['title'] ?? '') === '' && (row['url'] ?? '') === '')
    return 'the row has no title and no address';
  return undefined;
};

/** The rows that may reach a door, and the rows that may not, each with its reason. */
export const planRows = (
  sources: readonly Fields[],
  map: readonly Fields[],
): { readonly accepted: readonly PlannedRow[]; readonly refused: readonly RefusedRow[] } => {
  const mapped = new Map(map.map((row) => [row['id'] ?? '', row]));
  const seen = new Map<string, number>();
  for (const row of sources) seen.set(row['id'] ?? '', (seen.get(row['id'] ?? '') ?? 0) + 1);

  const refused: RefusedRow[] = [];
  const valid: PlannedRow[] = [];
  sources.forEach((row, at) => {
    const id = row['id'] ?? '';
    const entry = mapped.get(id);
    const fault = faultOf(row, entry, seen.get(id) ?? 0);
    if (fault !== undefined || entry === undefined) {
      refused.push({ id: id === '' ? `row ${at + 2}` : id, detail: fault ?? 'no map row' });
      return;
    }
    valid.push({
      id,
      letter: row['admiralty'] ?? '',
      title: row['title'] ?? '',
      url: row['url'] ?? '',
      name: row['name'] ?? '',
      consulted: row['date_consultation'] ?? '',
      canonicalId: entry['canonical_id'] ?? '',
      kind: entry['kind'] ?? '',
      path: entry['path'] ?? '',
    });
  });

  const lettersOf = new Map<string, Set<string>>();
  for (const row of valid)
    lettersOf.set(row.canonicalId, (lettersOf.get(row.canonicalId) ?? new Set()).add(row.letter));
  const conflicted = new Set(
    [...lettersOf].filter(([, letters]) => letters.size > 1).map(([canonicalId]) => canonicalId),
  );
  for (const row of valid.filter((one) => conflicted.has(one.canonicalId)))
    refused.push({
      id: row.id,
      detail:
        `${row.canonicalId} has the letters ${[...(lettersOf.get(row.canonicalId) ?? [])].join(', ')} ` +
        'on its rows: one originator has one letter',
    });
  return { accepted: valid.filter((row) => !conflicted.has(row.canonicalId)), refused };
};

// ------------------------------------------------------------------------------ the load -------

export type OriginatorStore = (file: StoredFile) => Promise<StoreResult>;

export interface RowReport {
  readonly id: string;
  readonly canonicalId?: string;
  readonly status: 'loaded' | 'unchanged' | 'partial' | 'refused';
  readonly detail: string;
  readonly documentId?: string;
}

export interface OriginatorReport {
  readonly rows: readonly RowReport[];
  readonly licence: string;
}

/** The id of a document that has no bytes: the hash of its address, or of its title. */
export const documentIdOfAddress = (address: string, title: string): string =>
  `doc_${createHash('sha256')
    .update(address === '' ? title : address)
    .digest('hex')
    .slice(0, 12)}`;

const firstLine = (error: unknown): string =>
  error instanceof Error ? (error.message.split('\n')[0] ?? 'refused') : 'refused';

const reasonOfGroup = (rows: readonly PlannedRow[]): string =>
  `operator letter of the source list, rows ${rows.map((row) => row.id).join(', ')}`;

const letterOf = (rows: readonly unknown[]): string | null => {
  const [row] = rows;
  if (typeof row !== 'object' || row === null || !('letter' in row)) return null;
  return typeof row.letter === 'string' ? row.letter : null;
};

type Step =
  { readonly status: 'loaded' | 'unchanged' } | { readonly status: 'refused'; detail: string };

// The door that sets a letter also clears a contest and stamps the act of the operator, so it is
// called only for an originator that holds no letter. No role reads the table, so the read is the
// letter that applies: an originator that exists and shows another letter keeps it, and a reload
// never changes a letter.
const originatorStep = async (ask: Ask, rows: readonly PlannedRow[]): Promise<Step> => {
  const [first] = rows;
  if (first === undefined) return { status: 'unchanged' };
  const stored = letterOf(
    await ask('SELECT public.originator_letter_for($1::text, NULL::text) AS letter', [
      first.canonicalId,
    ]),
  );
  if (stored === first.letter) return { status: 'unchanged' };
  if (stored !== null)
    return {
      status: 'refused',
      detail: `stored letter differs: ${stored} is held, ${first.letter} is in the map`,
    };
  try {
    // One statement, so the originator and its letter are written together or not at all. The
    // kind is the only field of the row that comes from the map: a jurisdiction and a role stay
    // empty, and only code sets a party from them.
    await ask(
      `SELECT public.set_operator_letter(e.id, $4::text, $5::text)
         FROM (SELECT public.ensure_originator($1::text, $2::text, $3::text) AS id) AS e`,
      [
        first.canonicalId,
        rows.map((row) => row.name).find((name) => name !== '') ?? first.canonicalId,
        first.kind,
        first.letter,
        reasonOfGroup(rows),
      ],
    );
    return { status: 'loaded' };
  } catch (error) {
    return { status: 'refused', detail: firstLine(error) };
  }
};

type Documented = { readonly written: boolean; readonly id: string } | { readonly refusal: string };

const insideData = (folder: string, path: string): string | undefined => {
  const full = resolve(folder, path);
  return insideFolder(full, resolve(folder)) && full !== resolve(folder) ? full : undefined;
};

const documentStep = async (
  row: PlannedRow,
  dataFolder: string | null,
  door: LoadDoor,
): Promise<Documented> => {
  if (row.path === '') {
    const id = documentIdOfAddress(row.url, row.title);
    const known = await door.ask('SELECT id FROM public.documents WHERE id = $1::text', [id]);
    if (known.length > 0) return { written: false, id };
    await door.ask('SELECT public.put_document($1, $2, $3, NULL, $4, NULL, NULL, NULL, NULL)', [
      id,
      'url',
      row.title === '' ? row.url : row.title,
      row.url === '' ? null : row.url,
    ]);
    return { written: true, id };
  }
  if (dataFolder === null) return { refusal: 'a file is mapped, and no data folder is given' };
  const full = insideData(dataFolder, row.path);
  if (full === undefined) return { refusal: 'the mapped file is outside the data folder' };
  const real =
    DAY.test(row.consulted) &&
    new Date(`${row.consulted}T00:00:00Z`).toISOString().slice(0, 10) === row.consulted;
  if (!real) return { refusal: 'the row has no real reading date, and a file needs one' };
  const bytes = await readFile(full);
  const stored = await door.store({
    bytes,
    fileName: basename(full),
    title: row.title === '' ? basename(full) : row.title,
    kind: 'file',
    retrievedAt: row.consulted,
    uri: row.url === '' ? null : row.url,
    providerId: null,
    costEur: null,
  });
  return { written: stored.status === 'stored', id: stored.id };
};

export interface LoadDoor {
  readonly ask: Ask;
  readonly store: OriginatorStore;
}

/** Loads the planned rows through the doors, and reports what happened to each row. */
export const loadOriginators = async (
  input: {
    readonly sources: readonly Fields[];
    readonly map: readonly Fields[];
    readonly dataFolder: string | null;
  },
  door: LoadDoor,
): Promise<OriginatorReport> => {
  const plan = planRows(input.sources, input.map);
  const reports = new Map<string, RowReport>(
    plan.refused.map((row) => [row.id, { id: row.id, status: 'refused', detail: row.detail }]),
  );

  const groups = Map.groupBy(plan.accepted, (row) => row.canonicalId);
  for (const [canonicalId, rows] of groups) {
    const step = await originatorStep(door.ask, rows);
    for (const row of rows) {
      if (step.status === 'refused') {
        reports.set(row.id, { id: row.id, canonicalId, status: 'refused', detail: step.detail });
        continue;
      }
      try {
        const document = await documentStep(row, input.dataFolder, door);
        if ('refusal' in document)
          reports.set(row.id, {
            id: row.id,
            canonicalId,
            status: 'partial',
            detail: `the originator is loaded, and the document is refused: ${document.refusal}`,
          });
        else
          reports.set(row.id, {
            id: row.id,
            canonicalId,
            status: step.status === 'loaded' || document.written ? 'loaded' : 'unchanged',
            detail: 'the letter and the document are in place',
            documentId: document.id,
          });
      } catch (error) {
        reports.set(row.id, {
          id: row.id,
          canonicalId,
          status: 'partial',
          detail: `the originator is loaded, and the document is refused: ${firstLine(error)}`,
        });
      }
    }
  }

  // The report keeps the order of the source list.
  const ordered = input.sources.flatMap((row, at) => {
    const id = row['id'] ?? '';
    const held = reports.get(id === '' ? `row ${at + 2}` : id);
    return held === undefined ? [] : [held];
  });
  return { rows: ordered, licence: LICENCE_NOTE };
};

// ------------------------------------------------------------------------------ the files ------

/** True when a path is the folder or lies under it. A path that only shares the first letters is not. */
export const insideFolder = (path: string, folder: string): boolean => {
  const way = relative(resolve(folder), resolve(path));
  return way === '' || (way !== '..' && !way.startsWith(`..${sep}`) && !isAbsolute(way));
};

/** Refuses the file that the proposal wrote. The operator reads it and saves it under a new name. */
export const checkedMapName = (file: string): void => {
  if (/\.proposed\.csv$/i.test(basename(file)))
    throw new Error(
      'The map is a proposed file. Read it, correct it, and save it under another name.',
    );
};

const PROPOSED_HEADER = ['id', 'canonical_id', 'kind', 'path', 'match_reason'] as const;
const MAP_HEADER = ['id', 'canonical_id', 'document_id', 'claim_ids'] as const;

const filesUnder = async (folder: string): Promise<readonly string[]> =>
  (await readdir(folder, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort();

const outputFolder = async (stated: string | undefined): Promise<string> => {
  if (stated === undefined || stated === '') throw new Error('--out is required.');
  const folder = resolve(stated);
  if (insideFolder(folder, cwd()) || insideFolder(cwd(), folder))
    throw new Error('--out must lie outside the working folder: the output holds private data.');
  await mkdir(folder, { recursive: true });
  return folder;
};

const readSources = async (file: string): Promise<readonly Fields[]> =>
  rowsOfCsv(await readFile(file, 'utf8'));

const requireColumns = (rows: readonly Fields[], names: readonly string[], what: string): void => {
  const [first] = rows;
  const missing = names.filter((name) => first !== undefined && !(name in first));
  if (missing.length > 0) throw new Error(`${what} has no column ${missing.join(', ')}.`);
};

const USAGE =
  'Usage: pnpm load:originators <sources.csv> --propose-map <data folder> --out <folder>\n' +
  '       pnpm load:originators <sources.csv> --map <originators.csv> --data <data folder> --out <folder>';

const proposeRun = async (
  sourcesFile: string,
  dataFolder: string,
  out: string,
): Promise<number> => {
  const sources = await readSources(sourcesFile);
  requireColumns(sources, ['id'], 'The source list');
  const proposed = proposeMap(sources, await filesUnder(dataFolder));
  const target = join(out, 'originators.proposed.csv');
  await writeFile(
    target,
    csvOfRows(
      PROPOSED_HEADER,
      proposed.map((row) => PROPOSED_HEADER.map((name) => row[name])),
    ),
  );
  console.log(`${proposed.length} rows proposed. Nothing was loaded.`);
  console.log(`The proposal is ${target}. Read it, and save it as originators.csv.`);
  return 0;
};

const loadRun = async (
  sourcesFile: string,
  mapFile: string,
  dataFolder: string | null,
  out: string,
): Promise<number> => {
  checkedMapName(mapFile);
  const sources = await readSources(sourcesFile);
  requireColumns(sources, ['id', 'admiralty'], 'The source list');
  const map = rowsOfCsv(await readFile(mapFile, 'utf8'));
  requireColumns(map, PROPOSED_HEADER.slice(0, 4), 'The map');

  const pool = new Pool({ connectionString: connectionString('app') });
  const raw = openStore();
  try {
    const report = await loadOriginators(
      { sources, map, dataFolder },
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
    );
    for (const row of report.rows) console.log(`${row.status.padEnd(9)} ${row.id}  ${row.detail}`);
    console.log(report.licence);

    // Claim ids stay empty: no claim table exists yet, so no claim has an id to cite.
    await writeFile(
      join(out, 'sources-map.csv'),
      csvOfRows(
        MAP_HEADER,
        report.rows
          .filter((row) => row.canonicalId !== undefined)
          .map((row) => [row.id, row.canonicalId ?? '', row.documentId ?? '', '']),
      ),
    );
    return report.rows.some((row) => row.status === 'refused' || row.status === 'partial') ? 1 : 0;
  } finally {
    await pool.end();
  }
};

const main = async (): Promise<number> => {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv.slice(2),
      allowPositionals: true,
      strict: true,
      options: {
        'propose-map': { type: 'string' },
        map: { type: 'string' },
        data: { type: 'string' },
        out: { type: 'string' },
      },
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The arguments are not usable.');
    console.error(USAGE);
    return 2;
  }
  const { values, positionals } = parsed;
  const [sourcesFile] = positionals;
  const proposing = values['propose-map'];
  const mapFile = values.map;
  if (
    sourcesFile === undefined ||
    positionals.length !== 1 ||
    (proposing === undefined) === (mapFile === undefined)
  ) {
    console.error(USAGE);
    return 2;
  }
  const out = await outputFolder(values.out);
  return proposing === undefined
    ? loadRun(sourcesFile, mapFile ?? '', values.data ?? null, out)
    : proposeRun(sourcesFile, proposing, out);
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  });
}
