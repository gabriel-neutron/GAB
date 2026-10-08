// A merge that leaves a conflict marker in a file breaks the file and tells nobody. This test reads
// each tracked text file and fails on a marker.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');

// The pattern is built from counts, so this file holds no marker of its own.
const MARKER = new RegExp(`^(<{7}|>{7})( |$)`, 'mu');

test('no tracked text file holds a conflict marker', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter((file) => /\.(ts|tsx|md|json|ya?ml|sql|css|html|example)$/u.test(file));
  const marked = files.filter((file) => {
    try {
      return MARKER.test(readFileSync(path.join(ROOT, file), 'utf8'));
    } catch {
      return false;
    }
  });
  expect(marked).toStrictEqual([]);
});
