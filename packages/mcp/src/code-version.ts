// The version of the code that the server runs, so a session can see which commit answers it.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { z } from 'zod';

/** Runs git in the folder of this file and gives its output, or null when git fails or is absent. */
const gitOf = (args: readonly string[]): string | null => {
  try {
    return execFileSync('git', args, {
      cwd: import.meta.dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
      // A status of the server takes no lock that a git command of a session would meet.
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    }).trim();
  } catch {
    return null;
  }
};

const packageVersion = (): string =>
  z
    .object({ version: z.string() })
    .parse(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))).version;

/** The short hash of the commit of the checkout, with "-dirty" when the tree has changes, or the
 * version of the package when no git checkout is there. */
export const codeVersion = (git = gitOf, fallback = packageVersion): string => {
  const hash = git(['rev-parse', '--short', 'HEAD']);
  if (hash === null || hash === '') return fallback();
  const changes = git(['status', '--porcelain', '--untracked-files=no']);
  return changes === null || changes === '' ? hash : `${hash}-dirty`;
};
