import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { expect, test } from 'vitest';

test('the citation of a page of 50 million characters copies no array of the page', async () => {
  // A child process starts with its own peak RSS, which grows only with its own work.
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [join(import.meta.dirname, 'large-page-child.ts')],
    { maxBuffer: 1024 * 1024 },
  );
  const { growth, passage, folded } = JSON.parse(stdout) as {
    growth: number;
    passage: string;
    folded: unknown;
  };

  expect(passage).toBe('The tanker “Nayara” left');
  expect(folded).toStrictEqual({ start: 50_000_000, end: 50_000_024 });
  // The page alone is 100 MiB as a two-byte string. A copy as an array grows by hundreds of MiB.
  expect(growth).toBeLessThan(32);
}, 120_000);
