import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

type Env = Readonly<Record<string, string | undefined>>;

// External constraint: a client starts the server from the research workspace or from the root of
// the repository, and on Windows a relative path follows the working folder. So each file is found
// from this source file.
const repositoryFile = (path: string): string =>
  fileURLToPath(new URL(`../../../${path}`, import.meta.url));

/** The files that the server reads, each one an absolute path that no working folder changes:
 * the environment of the research workspace, the environment of the stack, and the default
 * inbox. */
export const CONFIG_FILES = {
  research: repositoryFile('research/.env'),
  stack: repositoryFile('infra/.env'),
  inbox: repositoryFile('research/inbox'),
} as const;

// External constraint: Notepad of Windows can save the file with a byte order mark, and the parser
// then reads the first name with the mark in it.
const BOM = '\uFEFF';

/** The values of an environment file, or none when there is no file. */
export const envFileValues = (text: string | null): Env =>
  text === null ? {} : parseEnv(text.startsWith(BOM) ? text.slice(1) : text);

/** The text of a file, or null when it cannot be read. */
export const textOf = (file: string): string | null => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
};

/** The values of the research environment file that the process does not set. A value that the
 * process sets wins, also an empty one, as with the option `--env-file` of Node. */
export const researchEnvOf = (text: string | null, env: Env): Env =>
  Object.fromEntries(Object.entries(envFileValues(text)).filter(([name]) => !(name in env)));
