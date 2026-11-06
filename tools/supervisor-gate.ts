// The gate of the tenfold wave (BLD-03): the real tick and real headless workers with real gab tools
// run one tiny ticket in the session stack of this worktree, 1 clean run and 4 fault runs. It
// calls the model, so it is not part of the test suite. Run `pnpm stack:up` first. Windows only:
// the tick is PowerShell.
//
//   node tools/supervisor-gate.ts --out <folder> [--checkpoint <file>] [--only clean,db,gab,dns,token]
//
// Each run keeps its state folder under <folder>, with tick.log, the supervisor log of the run.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs, parseEnv } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = resolve(import.meta.dirname, '..');
const ENV_FILE = join(ROOT, 'infra', '.env');
const COMPOSE_FILE = join(ROOT, 'infra', 'docker-compose.yml');
const TICK = join(ROOT, 'tools', 'supervisor-tick.ps1');
const REAL_PROJECT = 'gab';
const REAL_DB_CONTAINER = 'gab-db-1';
const REAL_GAB_PORT = 7420;
const TEST_GAB_PORT = 7499;
// The cheapest model: this gate tests the loop, and the ticket needs two tool calls.
const MODEL = 'claude-haiku-5-5';
const TICK_MINUTES = 5; // Each tick moves the clock of the tick as the real task does.
const MAX_TICKS = 40;
const WORKER_LIMIT_MS = 8 * 60_000; // The CLI needs about 190 s to give up on a failed DNS name.
const SETTLE_MS = 15_000; // A repaired server takes this long to answer, on a PC with little free memory.
const FAULT_LIMIT_MS = 180_000;
const WAIT_LINE = 'node -e "setTimeout(()=>{},15000)"';
const EXPIRED = 'sk-ant-oat01-expired-gate-test';

const SCENARIOS = ['clean', 'db', 'gab', 'dns', 'token'] as const;
type Scenario = (typeof SCENARIOS)[number];

const PROMPT = `You are a proposer worker of a test ticket. No person reads this run. Do not ask a question. This ticket has 0 expected facts, so propose nothing.

Do these steps in order, one call for each step, with no retry:
1. Call mcp__gab__list_vocabulary.
2. If the State line below says working, run this command with Bash, and wait for it to end: ${WAIT_LINE}
3. Call mcp__gab__search_graph with the query "gate".

An empty answer is an answer. If each call of step 1 and step 3 gave an answer, your result is "close" when the State line says closing, and "pass" when it does not. If a gab tool is absent or gives an error, stop, and your result is "hold" with hold "waiting_service", and the reason names the error.`;

interface Ticket {
  state: string;
  attempts: number;
  noPass: number;
}
interface Status {
  alarms: string[];
}
type RealState = Record<string, unknown>;

const { values: flags } = parseArgs({
  options: {
    out: { type: 'string' },
    checkpoint: { type: 'string' },
    only: { type: 'string' },
  },
});
const OUT = resolve(flags.out ?? '');
if (flags.out === undefined) throw new Error('--out names the folder of the run logs');
const chosen = (flags.only?.split(',') ?? SCENARIOS) as readonly Scenario[];
if (chosen.some((name) => !SCENARIOS.includes(name))) throw new Error('--only: unknown scenario');

const stack = parseEnv(readFileSync(ENV_FILE, 'utf8'));
const PROJECT = stack['COMPOSE_PROJECT_NAME'] ?? '';
const DB_PORT = stack['GABRIEL_DB_PORT'] ?? '';
// The one guard of the real record: only a session stack takes a fault.
if (PROJECT === '' || PROJECT === REAL_PROJECT || DB_PORT === '' || DB_PORT === '5432')
  throw new Error('No session stack in this checkout. Run `pnpm stack:up` in a worktree.');

const scratch = mkdtempSync(join(tmpdir(), 'supervisor-gate-'));
const GAB_ENV = join(scratch, 'gab.env');
const password = encodeURIComponent(stack['GABRIEL_RESEARCH_PASSWORD'] ?? '');
writeFileSync(
  GAB_ENV,
  `GAB_RESEARCH_DATABASE_URL=postgresql://gabriel_research:${password}@127.0.0.1:${DB_PORT}/gabriel_test\n`,
);

// External constraint: a variable of the shell wins over the same variable of an --env-file.
const childEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !(name in stack) && name !== 'GAB_RESEARCH_DATABASE_URL',
  ),
);

const run = (program: string, args: readonly string[]) =>
  spawnSync(program, args, { cwd: ROOT, env: childEnv, encoding: 'utf8', timeout: 120_000 });

const claudePath = run('where.exe', ['claude']).stdout.split(/\r?\n/u)[0]?.trim() ?? '';
if (claudePath === '') throw new Error('The claude command is not on the path.');

const portAnswers = (port: number) =>
  new Promise<boolean>((done) => {
    const socket = createConnection({ port, host: '127.0.0.1', timeout: 2000 });
    const end = (answer: boolean) => {
      socket.destroy();
      done(answer);
    };
    socket.on('connect', () => {
      end(true);
    });
    socket.on('error', () => {
      end(false);
    });
    socket.on('timeout', () => {
      end(false);
    });
  });

const waitForPort = async (port: number, wanted: boolean) => {
  const deadline = Date.now() + FAULT_LIMIT_MS;
  while ((await portAnswers(port)) !== wanted) {
    if (Date.now() > deadline) throw new Error(`port ${String(port)} is not ${String(wanted)}`);
    await sleep(1000);
  }
};

const compose = (...args: string[]) => [
  'compose',
  '-p',
  PROJECT,
  '--env-file',
  ENV_FILE,
  '-f',
  COMPOSE_FILE,
  ...args,
];
const gabServer = {
  command: 'node',
  args: [
    `--env-file=${GAB_ENV}`,
    join('packages', 'mcp', 'src', 'main.ts'),
    '--http',
    String(TEST_GAB_PORT),
  ],
  workDir: ROOT,
};

const stopTestGab = () => {
  const held = run('powershell.exe', [
    '-NoProfile',
    '-Command',
    `(Get-NetTCPConnection -LocalPort ${String(TEST_GAB_PORT)} -State Listen -ErrorAction SilentlyContinue).OwningProcess`,
  ]).stdout;
  for (const pid of new Set(held.split(/\s+/u).filter(Boolean)))
    run('taskkill.exe', ['/T', '/F', '/PID', pid]);
};

const startTestGab = async () => {
  run('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Start-Process -FilePath node -ArgumentList '${gabServer.args.join("','")}' -WorkingDirectory '${ROOT}' -WindowStyle Hidden`,
  ]);
  await waitForPort(TEST_GAB_PORT, true);
};

const stateFolder = (name: Scenario, env: Record<string, string>) => {
  const dir = join(OUT, name);
  if (existsSync(dir)) throw new Error(`${dir} exists: name a new --out folder`);
  mkdirSync(join(dir, 'tickets'), { recursive: true });
  const mcp = join(dir, 'gab.mcp.json');
  writeFileSync(
    mcp,
    JSON.stringify({
      mcpServers: { gab: { type: 'http', url: `http://127.0.0.1:${String(TEST_GAB_PORT)}/mcp` } },
    }),
  );
  writeSettings(dir, env, mcp);
  writeFileSync(
    join(dir, 'tickets', `GATE-${name}.json`),
    JSON.stringify({ id: `GATE-${name}`, state: 'ready', prompt: PROMPT, forecast: 0 }),
  );
  return dir;
};

const writeSettings = (dir: string, env: Record<string, string>, mcp: string) => {
  writeFileSync(
    join(dir, 'supervisor.json'),
    JSON.stringify({
      cap: 1,
      command: claudePath,
      args: [
        '-p',
        '--model',
        MODEL,
        '--strict-mcp-config',
        '--mcp-config',
        mcp,
        '--allowedTools',
        'mcp__gab__list_vocabulary,mcp__gab__search_graph,Bash(node:*)',
        '--max-turns',
        '12',
        '--output-format',
        'stream-json',
        '--verbose',
      ],
      // Outside the repository: a session end in the checkout would run its hook of `stack:down`.
      workDir: scratch,
      env,
      notifyFile: join(dir, 'notified.txt'),
      services: [
        {
          name: 'test database',
          address: `127.0.0.1:${DB_PORT}`,
          repair: { command: 'docker', args: compose('start', 'db'), workDir: ROOT },
        },
        {
          name: 'test gab server',
          address: `127.0.0.1:${String(TEST_GAB_PORT)}`,
          repair: gabServer,
        },
      ],
    }),
  );
};

const readTicket = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as Ticket;

const workerFiles = (dir: string, end: string) =>
  existsSync(join(dir, 'workers'))
    ? readdirSync(join(dir, 'workers'))
        .filter((f) => f.endsWith(end))
        .sort()
    : [];

const tick = (dir: string, clock: Date) => {
  const done = run('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    TICK,
    '-StateDir',
    dir,
    '-Now',
    clock.toISOString(),
  ]);
  if (done.status !== 0) throw new Error(`a tick failed: ${done.stdout} ${done.stderr}`);
};

// A fault during a worker: it comes after the first tool answer, in the wait of the ticket, so the
// next tool call of the same worker meets it.
const FAULT_NOW: Partial<Record<Scenario, () => void>> = {
  db: () => {
    run('docker', compose('stop', 'db'));
  },
  gab: stopTestGab,
};

const waitForWorker = async (dir: string, name: Scenario, fault: { due: boolean }) => {
  const started = workerFiles(dir, '.spec.json').length;
  const deadline = Date.now() + WORKER_LIMIT_MS;
  while (workerFiles(dir, '.exit').length < started) {
    if (Date.now() > deadline) throw new Error(`${name}: a worker did not end`);
    const inject = FAULT_NOW[name];
    if (fault.due && inject !== undefined) {
      const out = join(dir, 'workers', `GATE-${name}-1.out`);
      if (existsSync(out) && readFileSync(out, 'utf8').includes('"tool_use_id"')) {
        inject();
        fault.due = false;
      }
    }
    await sleep(500);
  }
};

const lastWorkerUsedTools = (dir: string) => {
  const files = workerFiles(dir, '.out');
  const last = files.at(-1);
  if (last === undefined) return false;
  const text = readFileSync(join(dir, 'workers', last), 'utf8');
  return (
    text.includes('"name":"mcp__gab__list_vocabulary"') &&
    text.includes('"name":"mcp__gab__search_graph"') &&
    !text.includes('"is_error":true')
  );
};

// A research session of the operator can write to the record during this gate, so a count of rows
// proves nothing. A worker here holds no write tool and only the test server, and this shows each
// writer of the record in the time of the gate, for the closer.
const recordWriters = (from: Date) =>
  run('docker', [
    'exec',
    REAL_DB_CONTAINER,
    'psql',
    '-U',
    'gabriel',
    '-d',
    'gabriel',
    '-tAc',
    `select author_role, left(originator, 60), count(*) from public.proposals where created_at >= '${from.toISOString()}' group by 1, 2`,
  ])
    .stdout.trim()
    .split(/\r?\n/u);

const runScenario = async (name: Scenario) => {
  const dir = stateFolder(
    name,
    name === 'dns'
      ? { ANTHROPIC_BASE_URL: 'https://dns-fault.invalid' }
      : name === 'token'
        ? { CLAUDE_CODE_OAUTH_TOKEN: EXPIRED }
        : {},
  );
  const ticketFile = join(dir, 'tickets', `GATE-${name}.json`);
  const mcp = join(dir, 'gab.mcp.json');
  const clock = new Date();
  const fault = { due: name in FAULT_NOW };
  const seen: string[] = [];
  let heldTicks = 0;
  let dnsCleared = false;
  for (let i = 0; i < MAX_TICKS; i++) {
    tick(dir, clock);
    clock.setMinutes(clock.getMinutes() + TICK_MINUTES);
    const { state } = readTicket(ticketFile);
    if (seen.at(-1) !== state) seen.push(state);
    if (state === 'closed' || state === 'parked' || state === 'closed_exhausted') break;
    // The token fault must stay in its hold, with no new worker. 3 ticks are under its 30 minutes.
    if (name === 'token' && state === 'waiting_token' && ++heldTicks > 3) break;
    // The network comes back with no act of a person, after the worker met the failed name.
    if (name === 'dns' && state === 'waiting_service' && !dnsCleared) {
      writeSettings(dir, {}, mcp);
      dnsCleared = true;
    }
    if (workerFiles(dir, '.exit').length < workerFiles(dir, '.spec.json').length)
      await waitForWorker(dir, name, fault);
    else if (state.startsWith('waiting_') || name === 'db' || name === 'gab')
      await sleep(SETTLE_MS);
  }

  const ticket = readTicket(ticketFile);
  const alarms = (JSON.parse(readFileSync(join(dir, 'status.json'), 'utf8')) as Status).alarms;
  const log = readFileSync(join(dir, 'tick.log'), 'utf8');
  const notified = existsSync(join(dir, 'notified.txt'))
    ? readFileSync(join(dir, 'notified.txt'), 'utf8').trim().split(/\r?\n/u)
    : [];
  const gaps: string[] = [];
  const want = (ok: boolean, gap: string) => {
    if (!ok) gaps.push(gap);
  };
  want(ticket.attempts === 0 && ticket.noPass === 0, 'the fault cost an attempt');
  if (name === 'token') {
    want(ticket.state === 'waiting_token', `state is ${ticket.state}, not waiting_token`);
    want(workerFiles(dir, '.spec.json').length === 1, 'a worker started during the token hold');
    want(
      alarms.length === 1 && alarms[0]?.includes('waiting_token') === true,
      'the status has no one alarm for the token',
    );
    want(
      notified.length > 0 && notified.every((line) => line.includes('waiting_token')),
      'a notification has another reason',
    );
  } else {
    want(ticket.state === 'closed', `state is ${ticket.state}, not closed`);
    want(alarms.length === 0 && notified.length === 0, `an alarm fired: ${notified.join(' ')}`);
    want(lastWorkerUsedTools(dir), 'the last worker did not read both gab tools with no error');
  }
  if (name === 'clean') want(!log.includes('waiting_service'), 'the clean run met a hold');
  if (name === 'db' || name === 'gab' || name === 'dns')
    want(log.includes('> waiting_service'), 'the fault gave no waiting_service hold');
  if (name === 'db' || name === 'gab') {
    want(log.includes('service down'), 'the tick saw no stopped service');
    want(!fault.due, 'the fault did not run');
  }
  for (const file of workerFiles(dir, '.out')) {
    const called = readFileSync(join(dir, 'workers', file), 'utf8').match(
      /"name":"mcp__gab__\w+"/gu,
    );
    want(
      (called ?? []).every((n) => n.includes('list_vocabulary') || n.includes('search_graph')),
      `${file} called another gab tool`,
    );
  }
  return {
    name,
    state: ticket.state,
    attempts: ticket.attempts,
    workers: workerFiles(dir, '.spec.json').length,
    states: seen,
    alarms,
    gaps,
  };
};

// The prefix of the checkpoint: a running collector only adds lines to it.
const checkpointPrefix = (size: number) => {
  if (flags.checkpoint === undefined) return null;
  return createHash('sha256')
    .update(readFileSync(flags.checkpoint).subarray(0, size))
    .digest('hex');
};

const realState = (checkpointSize: number): RealState => ({
  containers: run('docker', [
    'ps',
    '-a',
    '--filter',
    `label=com.docker.compose.project=${REAL_PROJECT}`,
    '--format',
    '{{.ID}} {{.Names}} {{.State}} {{.RunningFor}}',
  ])
    .stdout.split(/\r?\n/u)
    .map((line) => line.split(' ').slice(0, 3).join(' '))
    .sort(),
  checkpoint: checkpointPrefix(checkpointSize),
});

mkdirSync(OUT, { recursive: true });
const checkpointSize = flags.checkpoint === undefined ? 0 : readFileSync(flags.checkpoint).length;
const gateStart = new Date();
const before = realState(checkpointSize);
const realGabUp = await portAnswers(REAL_GAB_PORT);
const results = [];
try {
  if (await portAnswers(TEST_GAB_PORT)) throw new Error('The port of the test server is held.');
  await startTestGab();
  for (const name of chosen) {
    const result = await runScenario(name);
    results.push(result);
    console.log(JSON.stringify(result));
    // The next run starts on a sound stack, also after a gap.
    run('docker', compose('start', 'db'));
    await waitForPort(Number(DB_PORT), true);
    if (!(await portAnswers(TEST_GAB_PORT))) await startTestGab();
  }
} finally {
  stopTestGab();
  rmSync(scratch, { recursive: true, force: true });
}
const after = realState(checkpointSize);
const realUntouched =
  JSON.stringify(before) === JSON.stringify(after) &&
  realGabUp === (await portAnswers(REAL_GAB_PORT));
const pass = realUntouched && results.every((r) => r.gaps.length === 0);
const summary = {
  pass,
  realUntouched,
  before,
  after,
  recordWriters: recordWriters(gateStart),
  results,
};
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ pass, realUntouched }));
process.exit(pass ? 0 : 1);
