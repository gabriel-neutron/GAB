import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readSiteRelease } from '@gab/release/site-release';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { groupNodes } from './nodes';

const FOLDER = join(import.meta.dirname, '../../../packages/site/fixtures/release');

const release = (() => {
  const manifest = readFileSync(join(FOLDER, 'manifest.json'), 'utf8');
  const listed = z
    .object({ files: z.array(z.object({ path: z.string() })) })
    .parse(JSON.parse(manifest));
  return readSiteRelease(
    new Map([
      ['manifest.json', manifest],
      ...listed.files.map(({ path }) => [path, readFileSync(join(FOLDER, path), 'utf8')] as const),
    ]),
  );
})();

test('the page holds each row of the release table, retained nodes first', () => {
  const { retained, others } = groupNodes(release.criticalNodes);
  expect([...retained, ...others].map((one) => one.id).sort()).toStrictEqual(
    release.criticalNodes.map((one) => one.id).sort(),
  );
  expect(retained.every((one) => one.retained)).toBe(true);
  expect(others.some((one) => one.retained)).toBe(false);
});

test('the summary counts the candidates and the retained nodes', () => {
  const { retained, summary } = groupNodes(release.criticalNodes);
  expect(summary).toBe(
    `${String(release.criticalNodes.length)} candidate nodes, ${String(retained.length)} retained.`,
  );
});

test('a release with no node says so', () => {
  expect(groupNodes([]).summary).toBe('This release has no candidate node.');
});
