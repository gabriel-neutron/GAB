// The Docker stack of one session: `up` starts it from a worktree, and `down` removes it with its
// data. Many sessions share one small machine, so each one has a stack of its own and removes it.

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argv, exit, kill, pid as ownPid } from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseEnv } from 'node:util';

import {
  orphanStacks,
  projectOf,
  SESSION_STACK_CAP,
  sessionStacks,
  SLOTS,
  slotOf,
  slotPorts,
  stackValues,
  strayProcesses,
  withStackBlock,
  type SeenProcess,
  type SessionStack,
} from './stack-plan.ts';

const ROOT = realpathSync(join(import.meta.dirname, '..'));
const COMPOSE_FILE = join(ROOT, 'infra', 'docker-compose.yml');
const ENV_FILE = join(ROOT, 'infra', '.env');
const PROJECT = projectOf(ROOT);

// The services the db-test projects reach. The read service of the record and SearXNG stay off.
const TEST_SERVICES = ['db', 'postgrest-test', 'seaweedfs'] as const;

// Origin of the number: a process that ignores SIGTERM for this long gets SIGKILL. A SessionEnd
// hook has about 60 s, and the removal of the containers takes about 15 s.
const STOP_GRACE_MS = 2_000;

// Two sessions that start a stack at the same time could both pass the cap and take one slot. A
// lock file of the machine holds the census, the slot choice and the start in one step.
const LOCK_FILE = join(tmpdir(), 'gab-stack.lock');
// Origin of the numbers: the first start of a stack takes about 40 s, so a wait of 3 minutes
// covers two starts before this one.
const LOCK_WAIT_MS = 180_000;
const LOCK_POLL_MS = 1_000;

const fail = (message: string): never => {
  console.error(message);
  exit(1);
};

const run = (program: string, args: readonly string[], env = process.env): string => {
  const done = spawnSync(program, args, { cwd: ROOT, env, encoding: 'utf8' });
  if (done.error !== undefined) fail(`${program} did not start: ${done.error.message}`);
  if (done.status !== 0) fail(`${program} ${args.join(' ')} failed:\n${done.stderr}`);
  return done.stdout;
};

// External constraint: a variable of the shell wins over the same variable of an --env-file, for
// node and for compose. So each variable of the file leaves the environment of a child process.
const fileOnlyEnvironment = (): NodeJS.ProcessEnv => {
  const fromFile = parseEnv(readFileSync(ENV_FILE, 'utf8'));
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !(name in fromFile)));
};

const mainCheckout = (): string => {
  const first = /^worktree (.+)$/mu.exec(run('git', ['worktree', 'list', '--porcelain']))?.[1];
  return first === undefined ? fail('git lists no worktree.') : realpathSync(first);
};

const refuseInMain = (main: string): void => {
  if (main === ROOT)
    fail(
      'This is the main checkout. It keeps the shared `gab` stack, and `pnpm stack:up` and ' +
        '`pnpm stack:down` run in a worktree only.',
    );
};

const listedStacks = (): readonly SessionStack[] =>
  sessionStacks(run('docker', ['compose', 'ls', '--all', '--format', 'json']));

const removeStack = (name: string): void => {
  spawnSync('docker', ['compose', '-p', name, 'down', '-v', '--remove-orphans'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
};

const isAlive = (pid: number): boolean => {
  try {
    kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const holderOfLock = (): number | null => {
  try {
    return Number(readFileSync(LOCK_FILE, 'utf8'));
  } catch {
    return null;
  }
};

const dropLock = (): void => {
  if (holderOfLock() === ownPid) rmSync(LOCK_FILE, { force: true });
};

const takeLock = async (): Promise<void> => {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      writeFileSync(LOCK_FILE, String(ownPid), { flag: 'wx' });
      process.on('exit', dropLock);
      return;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    }
    const holder = holderOfLock();
    if (holder !== null && !isAlive(holder)) rmSync(LOCK_FILE, { force: true });
    else if (Date.now() >= deadline)
      fail(`Another \`pnpm stack:up\` (process ${String(holder)}) holds ${LOCK_FILE}. Try again.`);
    else await sleep(LOCK_POLL_MS);
  }
};

const portIsFree = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.listen(port, '127.0.0.1', () => {
      server.close(() => {
        resolve(true);
      });
    });
  });

const freeSlot = async (): Promise<number> => {
  for (const slot of SLOTS) {
    const free = await Promise.all(slotPorts(slot).map(portIsFree));
    if (free.every(Boolean)) return slot;
  }
  return fail('Every slot has a port that another program holds.');
};

const up = async (): Promise<void> => {
  const main = mainCheckout();
  refuseInMain(main);
  await takeLock();

  for (const orphan of orphanStacks(listedStacks(), main, existsSync)) {
    console.log(`Removing ${orphan.name}: its checkout is gone.`);
    removeStack(orphan.name);
  }

  const stacks = listedStacks();
  const own = stacks.find((stack) => stack.name === PROJECT);
  const others = stacks.filter((stack) => stack.running && stack.name !== PROJECT);
  if (others.length >= SESSION_STACK_CAP)
    fail(
      `${String(others.length)} session stacks run, and the cap is ${String(SESSION_STACK_CAP)}:\n` +
        others.map((stack) => `  ${stack.name}  ${stack.configFiles.join(', ')}`).join('\n') +
        '\nStop one with `pnpm stack:down` in its worktree, or with ' +
        '`docker compose -p <name> down -v --remove-orphans`.',
    );

  if (!existsSync(ENV_FILE)) {
    const source = join(main, 'infra', '.env');
    if (!existsSync(source)) fail('The main checkout holds no infra/.env to copy.');
    copyFileSync(source, ENV_FILE);
  }
  const text = readFileSync(ENV_FILE, 'utf8');
  const slot = (own?.running === true ? slotOf(text) : null) ?? (await freeSlot());
  const values = stackValues(PROJECT, slot);
  writeFileSync(ENV_FILE, withStackBlock(text, values));

  const env = fileOnlyEnvironment();
  const compose = ['compose', '-p', PROJECT, '--env-file', ENV_FILE, '-f', COMPOSE_FILE];
  const started = spawnSync('docker', [...compose, 'up', '-d', '--wait', ...TEST_SERVICES], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });
  if (started.status !== 0) fail(`${PROJECT} did not start. Run \`pnpm stack:down\` to clean up.`);
  dropLock();

  const reset = spawnSync('node', ['--env-file=infra/.env', 'tools/db-reset.ts'], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });
  if (reset.status !== 0) fail(`The reset of gabriel_test in ${PROJECT} failed.`);

  console.log(
    `${PROJECT} runs in slot ${String(slot)}: database 127.0.0.1:${values['GABRIEL_DB_PORT']}, ` +
      `read service ${values['GABRIEL_TEST_API_URL']}, raw store ${values['RAW_STORE_ENDPOINT']}.`,
  );
};

const parentOf = (pid: number): number | null => {
  try {
    const stat = readFileSync(`/proc/${String(pid)}/stat`, 'utf8');
    const parent = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1];
    return parent === undefined ? null : Number(parent);
  } catch {
    return null;
  }
};

const ownLine = (): ReadonlySet<number> => {
  const line = new Set<number>();
  for (let pid: number | null = ownPid; pid !== null && pid > 1; pid = parentOf(pid)) line.add(pid);
  return line;
};

const seenProcess = (pid: number): SeenProcess | null => {
  try {
    const cwd = readlinkSync(`/proc/${String(pid)}/cwd`);
    const argv = readFileSync(`/proc/${String(pid)}/cmdline`, 'utf8')
      .split('\0')
      .filter(Boolean);
    return { pid, cwd, argv };
  } catch {
    return null;
  }
};

// Departure: `pkill -f` matched the shell of the agent itself, so the filter reads the working
// folder of each process and spares this process and its parents.
const stopStrayProcesses = async (): Promise<void> => {
  if (!existsSync('/proc')) return;
  const seen = readdirSync('/proc')
    .filter((name) => /^\d+$/u.test(name))
    .map((name) => seenProcess(Number(name)))
    .filter((one) => one !== null);
  const stray = strayProcesses(seen, ROOT, ownLine(), existsSync);
  const signal = (pids: readonly number[], name: NodeJS.Signals): void => {
    for (const pid of pids) {
      try {
        kill(pid, name);
      } catch {
        // The process stopped already.
      }
    }
  };
  if (stray.length === 0) return;
  console.log(`Stopping the node processes of this worktree: ${stray.join(', ')}.`);
  signal(stray, 'SIGTERM');
  await sleep(STOP_GRACE_MS);
  signal(
    stray.filter((pid) => existsSync(`/proc/${String(pid)}`)),
    'SIGKILL',
  );
};

const down = async (): Promise<void> => {
  refuseInMain(mainCheckout());
  await stopStrayProcesses();
  if (!listedStacks().some((stack) => stack.name === PROJECT)) {
    console.log(`No stack ${PROJECT} exists. Nothing to remove.`);
    return;
  }
  removeStack(PROJECT);
};

const command = argv[2];
if (command === 'up') await up();
else if (command === 'down') await down();
else fail('Usage: node tools/stack.ts up | down');
