import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { releaseAssets } from './release-folder.ts';

const FOLDER = join(import.meta.dirname, '../packages/site/fixtures/release');

const listed = z
  .object({ files: z.array(z.object({ path: z.string(), sha256: z.string() })) })
  .parse(JSON.parse(readFileSync(join(FOLDER, 'manifest.json'), 'utf8')));

test('the build copies every file of the release, byte for byte', () => {
  const copies = new Map(releaseAssets(FOLDER).map((one) => [one.fileName, one.source]));
  for (const file of listed.files) {
    const copy = copies.get(`release/${file.path}`);
    expect(copy).toBeDefined();
    expect(copy?.equals(readFileSync(join(FOLDER, file.path)))).toBe(true);
  }
  expect(copies.has('release/manifest.json')).toBe(true);
});
