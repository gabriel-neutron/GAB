// A new role or a new service adds a line to the example, and nothing copies it into the real
// file. Each test that reaches it then fails on its own, so one missing name hides among many red
// tests. This module compares the names of the two files, and it never reads out a value.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** The names an environment file sets. A comment line or a blank line sets nothing. */
export const namesSet = (text: string): Set<string> =>
  new Set(
    text
      .split(/\r?\n/u)
      .map((line) => /^\s*([A-Z_][A-Z0-9_]*)\s*=/u.exec(line)?.[1])
      .filter((name): name is string => name !== undefined),
  );

/** The names the example sets and the real file does not, in a stable order. */
export const missingNames = (example: string, actual: string): string[] => {
  const held = namesSet(actual);
  return [...namesSet(example)].filter((name) => !held.has(name)).sort();
};

/** One sentence that names each missing variable. It names no value. */
export const envDriftSentence = (missing: readonly string[]): string =>
  `infra/.env does not set ${missing.join(', ')}, and infra/.env.example sets ` +
  `${missing.length === 1 ? 'it' : 'them'}. Copy each missing line from the example into ` +
  'infra/.env, then run `pnpm db:migrate`.';

/** Stops when the real file of the build stack lacks a name that its example sets. */
export const assertNoEnvDrift = (root: string): void => {
  const infra = path.join(root, 'infra');
  const realFile = path.join(infra, '.env');
  // An absent real file sets no name, so the sentence names every line of the example.
  const actual = existsSync(realFile) ? readFileSync(realFile, 'utf8') : '';
  const missing = missingNames(readFileSync(path.join(infra, '.env.example'), 'utf8'), actual);
  if (missing.length > 0) throw new Error(envDriftSentence(missing));
};
