// Proves a sweep changed comments and no code. It compares the code lines of each changed
// file under `src/` against a git reference. `pnpm check` runs no test, so this is the net.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { codeOf } from './comment-budget.ts';

const git = (args: readonly string[]): string =>
  execFileSync('git', [...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const [, , reference = 'HEAD', ...only] = process.argv;

const changed = git(['diff', '--name-only', reference, '--', ...(only.length > 0 ? only : ['src'])])
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => /\.tsx?$/.test(line));

const moved: string[] = [];

for (const path of changed) {
  const before = git(['show', `${reference}:${path}`]);
  let after: string;
  try {
    after = readFileSync(path, 'utf8');
  } catch {
    moved.push(`${path}  deleted`);
    continue;
  }
  if (codeOf(before) !== codeOf(after)) moved.push(`${path}  code moved`);
}

moved.forEach((line) => console.error(line));
console.log(
  moved.length === 0
    ? `IDENTICAL  ${changed.length} files changed, no code moved`
    : `CODE MOVED in ${moved.length} of ${changed.length} files`,
);
process.exitCode = moved.length === 0 ? 0 : 1;
