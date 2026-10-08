// The plan of the Docker stack of one session: its slot, its ports, its block in infra/.env, the
// stacks it must remove first, and the processes it must stop. Nothing here reaches Docker, the
// disk or a process, so an offline test holds each rule.

import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { z } from 'zod';

// Origin of the number: the VPS has 2 CPUs, 7.8 GB of RAM and no swap. One session stack holds a
// database and a raw store beside the main stack, and a third test run at the same time crashed
// the machine.
export const SESSION_STACK_CAP = 2;

/** The first part of the compose project name of each session stack. The main stack is `gab`. */
export const SESSION_PREFIX = 'gab-';

// Origin of the numbers: slot 0 is the main stack, and each slot adds 100 to each of its ports, so
// no two services and no two slots share a port. The cap needs two slots. The other slots are for
// the case where another program holds a port.
export const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const PORT_STEP = 100;

const MAIN_PORTS = {
  GAB_DB_PORT: 5432,
  GAB_API_PORT: 3000,
  GAB_API_TEST_PORT: 3001,
  GAB_RAW_STORE_PORT: 9000,
  GAB_SEARXNG_PORT: 8888,
} as const;

// Departure: SearXNG holds no record and keeps no state, so a session stack starts none and uses
// the one of the main stack.
const MAIN_SEARXNG_URL = 'http://127.0.0.1:8888';

const BLOCK_START = '# >>> session stack: `pnpm stack:up` writes this block and replaces it.';
const BLOCK_END = '# <<< session stack';

/** The ports that a slot publishes on 127.0.0.1. */
export const slotPorts = (slot: number): readonly number[] =>
  Object.values(MAIN_PORTS).map((port) => port + slot * PORT_STEP);

// Origin of the number: six hex digits of the full path keep two folders of the same name apart.
const PATH_HASH_LENGTH = 6;

/** The compose project name of the stack of one checkout: its folder name and a hash of its path. */
export const projectOf = (root: string): string => {
  const name = basename(root)
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]/gu, '-');
  const hash = createHash('sha256').update(root).digest('hex').slice(0, PATH_HASH_LENGTH);
  return `${SESSION_PREFIX}${name}-${hash}`;
};

/** The variables that point the tools, the tests and compose at the stack of one slot. */
export const stackValues = (project: string, slot: number): Readonly<Record<string, string>> => {
  const port = (name: keyof typeof MAIN_PORTS): string =>
    String(MAIN_PORTS[name] + slot * PORT_STEP);
  return {
    COMPOSE_PROJECT_NAME: project,
    GAB_STACK_SLOT: String(slot),
    GAB_DB_PORT: port('GAB_DB_PORT'),
    GAB_API_PORT: port('GAB_API_PORT'),
    GAB_API_TEST_PORT: port('GAB_API_TEST_PORT'),
    GAB_RAW_STORE_PORT: port('GAB_RAW_STORE_PORT'),
    GAB_SEARXNG_PORT: port('GAB_SEARXNG_PORT'),
    GABRIEL_DB_HOST: '127.0.0.1',
    GABRIEL_DB_PORT: port('GAB_DB_PORT'),
    GABRIEL_DB_SSL: 'false',
    RAW_STORE_ENDPOINT: `http://127.0.0.1:${port('GAB_RAW_STORE_PORT')}`,
    SEARXNG_URL: MAIN_SEARXNG_URL,
    GABRIEL_TEST_API_URL: `http://127.0.0.1:${port('GAB_API_TEST_PORT')}/`,
  };
};

const withoutBlock = (text: string): string => {
  const start = text.indexOf(BLOCK_START);
  const end = text.indexOf(BLOCK_END);
  if (start === -1) return text;
  // A block with no end mark was cut, so everything after its start goes.
  if (end === -1) return text.slice(0, start);
  return text.slice(0, start) + text.slice(end + BLOCK_END.length);
};

/**
 * The environment file with one block of stack values at its end. The block of an earlier run goes,
 * and so does each line outside it that sets one of the same names, so no copied value wins.
 */
export const withStackBlock = (text: string, values: Readonly<Record<string, string>>): string => {
  const names = new Set(Object.keys(values));
  const kept = withoutBlock(text)
    .split('\n')
    .filter((line) => !names.has(line.split('=')[0]?.trim() ?? ''))
    .join('\n')
    .trimEnd();
  const lines = Object.entries(values).map(([name, value]) => `${name}=${value}`);
  return `${kept}\n\n${[BLOCK_START, ...lines, BLOCK_END].join('\n')}\n`;
};

/** The slot that the block of the environment file names, or null when it names none. */
export const slotOf = (text: string): number | null => {
  const found = /^GAB_STACK_SLOT=(\d+)$/mu.exec(text);
  return found?.[1] === undefined ? null : Number(found[1]);
};

const listing = z.array(
  z.object({ Name: z.string(), Status: z.string(), ConfigFiles: z.string() }),
);

export interface SessionStack {
  readonly name: string;
  readonly running: boolean;
  readonly configFiles: readonly string[];
}

/** The session stacks in the output of `docker compose ls --all --format json`. */
export const sessionStacks = (json: string): readonly SessionStack[] =>
  listing
    .parse(JSON.parse(json))
    .filter((stack) => stack.Name.startsWith(SESSION_PREFIX))
    .map((stack) => ({
      name: stack.Name,
      running: stack.Status.includes('running'),
      configFiles: stack.ConfigFiles.split(',').filter((file) => file !== ''),
    }));

const isWorktreeComposeFile = (main: string, file: string): boolean =>
  basename(file) === 'docker-compose.yml' &&
  basename(dirname(file)) === 'infra' &&
  isInside(join(main, '.claude', 'worktrees'), file);

/**
 * The session stacks whose worktree is gone. Each compose file of the stack is the one of a
 * worktree of the main checkout, and none of them exists any more. A stack of another place stays.
 */
export const orphanStacks = (
  stacks: readonly SessionStack[],
  main: string,
  exists: (file: string) => boolean,
): readonly SessionStack[] =>
  stacks.filter(
    ({ configFiles }) =>
      configFiles.length > 0 &&
      configFiles.every((file) => isWorktreeComposeFile(main, file)) &&
      !configFiles.some(exists),
  );

export interface SeenProcess {
  readonly pid: number;
  readonly cwd: string;
  readonly argv: readonly string[];
}

const isInside = (root: string, path: string): boolean => {
  const step = relative(root, path);
  return step === '' || (!step.startsWith('..') && !isAbsolute(step));
};

const NODE_PROGRAMS = new Set(['node', 'node.exe']);

// External constraint: these flags of node take the next argument as their value, so that
// argument is not the script.
const FLAGS_WITH_VALUE = new Set([
  '-r',
  '--require',
  '--import',
  '--loader',
  '--experimental-loader',
  '-C',
  '--conditions',
  '--env-file',
  '--input-type',
]);

// The script of a node command line: the first argument after the flags of node. A command with
// no script (`node -e`, a prompt) has none.
const scriptOf = (args: readonly string[]): string | null => {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === '-e' || arg === '--eval' || arg === '-p' || arg === '--print') return null;
    if (FLAGS_WITH_VALUE.has(arg)) index += 1;
    else if (!arg.startsWith('-')) return arg;
  }
  return null;
};

/**
 * The node processes that this checkout started: each one works in the checkout and its script is
 * a file of the checkout. A process in `kept` (this process and its parents) never stops, and
 * neither does a program that runs from outside the checkout, such as a tool server of the agent.
 */
export const strayProcesses = (
  seen: readonly SeenProcess[],
  root: string,
  kept: ReadonlySet<number>,
  exists: (file: string) => boolean,
): readonly number[] =>
  seen
    .filter(({ pid, cwd, argv }) => {
      const [program = '', ...args] = argv;
      const script = scriptOf(args);
      if (kept.has(pid) || !NODE_PROGRAMS.has(basename(program)) || !isInside(root, cwd))
        return false;
      if (script === null) return false;
      const file = resolve(cwd, script);
      return isInside(root, file) && exists(file);
    })
    .map(({ pid }) => pid);
