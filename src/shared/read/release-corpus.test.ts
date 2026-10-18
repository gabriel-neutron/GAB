// The record of a release as the corpus. The fixture release holds invented rows, and the file is
// read from disk as the application reads it from the host.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readSiteRelease } from '@gab/release/site-release';
import { SEEDED_RELATION_TYPES } from '@gab/proposal/relation-types';
import { expect, test } from 'vitest';

import { corpusFromRelease } from './release-corpus';

const FOLDER = join(import.meta.dirname, '../../../packages/site/fixtures/release');

const files = (): Map<string, string> => {
  const manifest = readFileSync(join(FOLDER, 'manifest.json'), 'utf8');
  const listed = z_files(manifest);
  return new Map([
    ['manifest.json', manifest],
    ...listed.map((path) => [path, readFileSync(join(FOLDER, path), 'utf8')] as const),
  ]);
};

const z_files = (manifest: string): string[] => {
  const parsed: unknown = JSON.parse(manifest);
  if (typeof parsed !== 'object' || parsed === null || !('files' in parsed)) return [];
  const listed: unknown = parsed.files;
  if (!Array.isArray(listed)) return [];
  return listed.flatMap((one: unknown) =>
    typeof one === 'object' && one !== null && 'path' in one && typeof one.path === 'string'
      ? [one.path]
      : [],
  );
};

const release = readSiteRelease(files());
const corpus = corpusFromRelease(
  release,
  SEEDED_RELATION_TYPES.map((one) => ({ ...one, retired: false })),
);

test('each entity and each relation of the release arrives, and no act is pending', () => {
  expect(corpus.entities.map((one) => one.id)).toStrictEqual(release.entities.map((one) => one.id));
  expect(corpus.relations.map((one) => one.id)).toStrictEqual(
    release.relations.map((one) => one.id),
  );
  expect(corpus.proposals).toStrictEqual([]);
});

test('the map answers once for each entity, as the service does', () => {
  expect(corpus.positions).toHaveLength(corpus.entities.length);
});

test('a placed entity has its point, and an unplaced one has none', () => {
  const placed = corpus.positions.filter((one) => one.point !== null);
  expect(placed.length).toBeGreaterThan(0);
  expect(placed.length).toBeLessThan(corpus.positions.length);
  expect(placed.every((one) => one.precision === null && one.parentId === null)).toBe(true);
});

test('each source of a row names a document that arrived', () => {
  const held = new Set(corpus.documents.map((one) => one.id));
  const missing = [...corpus.entities, ...corpus.relations].flatMap((row) =>
    row.sources.filter((source) => !held.has(source)).map((source) => `${row.id}: ${source}`),
  );
  expect(missing).toStrictEqual([]);
});

test('an attribute keeps the documents that hold it up', () => {
  const attributes = corpus.entities.flatMap((one) => Object.values(one.attrs));
  expect(attributes.length).toBeGreaterThan(0);
  expect(attributes.every((one) => one.src.length > 0)).toBe(true);
});

test('a relation starts and ends at an entity of the release', () => {
  const ids = new Set(corpus.entities.map((one) => one.id));
  expect(
    corpus.relations.filter((one) => !ids.has(one.srcId) || !ids.has(one.dstId)),
  ).toStrictEqual([]);
});
