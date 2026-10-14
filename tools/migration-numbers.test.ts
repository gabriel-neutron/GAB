// Two branches can add a migration with the same number at the same time. The runner orders the
// files by name and runs both, so only this check finds the collision.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

const MIGRATIONS = join(import.meta.dirname, '..', 'db', 'migrations');

test('each number names one migration', () => {
  const numbers = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => name.slice(0, 4));
  expect(numbers.filter((number, index) => numbers.indexOf(number) !== index)).toStrictEqual([]);
});
