// The Baltic AIS collector. Fintraffic Digitraffic Marine keeps no archive, so Task Scheduler runs
// one pull for each period, with no model. Each pull stores each answer as one document, and adds
// one line for each answer to a checkpoint file outside the repository. A failed answer adds its
// reason, so the report can tell a gap with a reason from a gap with none.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { argv, env } from 'node:process';
import { fileURLToPath } from 'node:url';

import { openStore, putObject } from '@gab/store';
import { hashOf } from '@gab/tools/store-answer';
import { readRegister, storeRegister } from '@gab/tools/register-answer';
import { ToolRefusal, type Reach, type Session } from '@gab/tools/tool';
import { webOf } from '@gab/tools/web';
import pg from 'pg';
import { z } from 'zod';

const REGISTER = 'Digitraffic Marine';

// External constraint: the API refuses a request with no gzip (406), and it asks each client to
// name itself. With no `from`, each answer holds the last 24 hours. So an answer also holds what a
// short gap did not read, as the latest state of each vessel.
const HEADERS = { 'accept-encoding': 'gzip', 'digitraffic-user': 'GAB/ais-collector' };

const ENDPOINTS = {
  vessels: 'https://meri.digitraffic.fi/api/ais/v1/vessels',
  locations: 'https://meri.digitraffic.fi/api/ais/v1/locations',
} as const;

type Endpoint = keyof typeof ENDPOINTS;

const NAMES: readonly Endpoint[] = ['vessels', 'locations'];

const CHECKPOINT = 'ais-checkpoint.jsonl';

// The period of the scheduled task. A vessel crosses the Gulf of Finland in hours, so a shorter
// period adds little, and a longer one can lose a changed destination.
const PERIOD_MS = 60 * 60 * 1000;
// A task can start some seconds late, so one missed pull stays inside two periods.
const GRACE_MS = 5 * 60 * 1000;
const LONGEST_MS = 2 * PERIOD_MS + GRACE_MS;

export const lineShape = z.object({
  at: z.iso.datetime(),
  endpoint: z.enum(['vessels', 'locations']),
  status: z.enum(['stored', 'known', 'failed']),
  document: z.string().optional(),
  sha256: z.string().optional(),
  bytes: z.number().optional(),
  rows: z.number().optional(),
  reason: z.string().optional(),
});

export type Line = z.infer<typeof lineShape>;

// A fault of the database can hold its address, so only its code goes in the file.
const reasonOf = (fault: unknown): string => {
  if (fault instanceof ToolRefusal) return fault.message;
  if (typeof fault === 'object' && fault !== null && 'code' in fault) return String(fault.code);
  // A fault of the web is a refusal, so what stays is a fault of the record or of the store.
  return `the record or the store failed (${fault instanceof Error ? fault.name : 'no name'})`;
};

// The API gives an array of vessels, or a feature collection of locations. An answer with no row
// is a fault of the source, and it is no snapshot.
const rowsOf = (json: unknown): number => {
  const list = z.array(z.unknown()).safeParse(json);
  if (list.success) return list.data.length;
  const collection = z.object({ features: z.array(z.unknown()) }).safeParse(json);
  return collection.success ? collection.data.features.length : 0;
};

const pullOne = async (session: Session, reach: Reach, endpoint: Endpoint): Promise<Line> => {
  const at = reach.now().toISOString();
  try {
    if (reach.web === undefined) throw new ToolRefusal('this surface gives no web');
    const request = { url: ENDPOINTS[endpoint], register: REGISTER, headers: HEADERS };
    const answer = await readRegister(reach.web, request);
    if (answer === null) throw new ToolRefusal(`${REGISTER} answered 404`);
    const rows = rowsOf(answer.json);
    if (rows === 0) throw new ToolRefusal(`${REGISTER} gave an answer with no row`);
    const title = `Fintraffic Digitraffic Marine, AIS ${endpoint}, ${at.slice(0, 16)}Z`;
    const stored = await storeRegister(session, reach, { ...request, title }, answer);
    // shortcut: the web gives text, so an invalid UTF-8 byte of the source does not stay as it came.
    // The answers are UTF-8 JSON today. Upgrade if the web gives the bytes of a GET.
    const bytes = new TextEncoder().encode(answer.body);
    return {
      at,
      endpoint,
      status: stored.status,
      document: stored.document,
      sha256: hashOf(bytes),
      bytes: bytes.length,
      rows,
    };
  } catch (fault) {
    return { at, endpoint, status: 'failed', reason: reasonOf(fault) };
  }
};

/** One pull: one line for each endpoint, written as soon as its answer ends. */
export const pull = async (session: Session, reach: Reach, folder: string): Promise<boolean> => {
  mkdirSync(folder, { recursive: true });
  let clean = true;
  for (const endpoint of NAMES) {
    const line = await pullOne(session, reach, endpoint);
    // The newline comes first: a line that a power loss cut must not take this line with it.
    appendFileSync(join(folder, CHECKPOINT), `\n${JSON.stringify(line)}`);
    clean &&= line.status !== 'failed';
  }
  return clean;
};

const isoOf = (ms: number): string => new Date(ms).toISOString();

const gapsOf = (unsorted: readonly Line[], from: number, to: number) => {
  // A change of the clock can put a line out of order, and that must not hide a gap.
  const lines = unsorted.toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const times = lines.map((line) => Date.parse(line.at));
  // Each line is a pull that ran, also a failed pull. A longer time between two lines has no reason.
  const marks = [from, ...times, to];
  const noReason = marks.slice(1).flatMap((end, index) => {
    const start = marks[index] ?? end;
    return end - start > LONGEST_MS ? [{ from: isoOf(start), to: isoOf(end) }] : [];
  });
  const reasoned: { from: string; to: string; reasons: string[] }[] = [];
  let start = from;
  let reasons: string[] = [];
  for (const line of lines) {
    const time = Date.parse(line.at);
    if (line.status === 'failed') {
      reasons.push(line.reason ?? 'no reason in the line');
      continue;
    }
    if (reasons.length > 0 && time - start > LONGEST_MS)
      reasoned.push({ from: isoOf(start), to: isoOf(time), reasons });
    start = time;
    reasons = [];
  }
  if (reasons.length > 0 && to - start > LONGEST_MS)
    reasoned.push({ from: isoOf(start), to: isoOf(to), reasons });
  return { noReason, reasoned };
};

/** The checkpoint of the last hours, by endpoint. `clean` is true only when the lines cover the
 * whole window, each gap over two periods has a logged reason, and each endpoint has a snapshot. */
export const report = (lines: readonly Line[], hours: number, now: Date) => {
  const to = now.getTime();
  const from = to - hours * 60 * 60 * 1000;
  const inWindow = lines.filter((line) => {
    const time = Date.parse(line.at);
    return time >= from && time <= to;
  });
  const endpoints = NAMES.map((endpoint) => {
    const own = inWindow.filter((line) => line.endpoint === endpoint);
    const count = (status: Line['status']) => own.filter((line) => line.status === status).length;
    return {
      endpoint,
      stored: count('stored'),
      known: count('known'),
      failed: count('failed'),
      ...gapsOf(own, from, to),
    };
  });
  return {
    from: isoOf(from),
    to: isoOf(to),
    clean: endpoints.every((own) => own.noReason.length === 0 && own.stored + own.known > 0),
    endpoints,
  };
};

const linesIn = (folder: string): Line[] =>
  (existsSync(join(folder, CHECKPOINT)) ? readFileSync(join(folder, CHECKPOINT), 'utf8') : '')
    .split('\n')
    .flatMap((line) => {
      // A power loss can cut the last line. It is no pull that ended, so the report sees a gap.
      try {
        const read = lineShape.safeParse(JSON.parse(line));
        return read.success ? [read.data] : [];
      } catch {
        return [];
      }
    });

// Opened inside a pull, so a store with no credential gives a line with a reason, and no gap. The
// sentence of the store names no secret.
const storeOf = (): ReturnType<typeof openStore> => {
  try {
    return openStore();
  } catch (fault) {
    throw new ToolRefusal(fault instanceof Error ? fault.message : 'no object store');
  }
};

const runPull = async (folder: string): Promise<void> => {
  const pool = new pg.Pool({ connectionString: env['GAB_RESEARCH_DATABASE_URL'], max: 1 });
  // A dropped connection fails the next query, and the pull logs it. It must not end the process.
  pool.on('error', () => undefined);
  const reach: Reach = {
    store: { put: (object) => putObject(storeOf(), object) },
    web: webOf(env),
    now: () => new Date(),
  };
  const clean = await pull(pool, reach, folder);
  await pool.end().catch(() => undefined);
  if (!clean) process.exitCode = 1;
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  const [command, folder, given] = argv.slice(2);
  const hours = Number(given ?? 48);
  if (!(hours > 0)) throw new Error('the hours must be a number above 0');
  if (folder === undefined) throw new Error('usage: ais-collector pull|report <folder> [hours]');
  if (command === 'pull') await runPull(folder);
  else if (command === 'report')
    console.log(JSON.stringify(report(linesIn(folder), hours, new Date()), null, 2));
  else throw new Error(`no command ${String(command)}`);
}
