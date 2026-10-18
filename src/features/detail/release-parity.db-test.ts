// One record, read twice: over HTTP from the read service, and from the files of the release that
// the same record wrote. Each entity page that the release holds must come out the same from both
// reads (ADR 0028). The page is the one the application draws, and the test compares it.

import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readSiteRelease } from '@gab/release/site-release';
import { afterAll, beforeAll, expect, test } from 'vitest';

import { loadCorpus } from '@/shared/read/corpus';
import type { Corpus, TypeVocabulary } from '@/shared/read/model';
import { corpusFromRelease } from '@/shared/read/release-corpus';
import { loadEntityTypes, loadRelationTypes } from '@/shared/read/vocabulary';

import { readDossier } from './dossier';

const ROOT = join(import.meta.dirname, '../../..');

// The release command, as the operator runs it. It reads the test database, because the test
// run names it in the environment, and it writes the site beside the release.
const MANIFEST = {
  version: '0.1-test',
  date: '2026-11-08',
  contacts: {
    reportError: 'https://example.org/report-an-error',
    rightOfReply: 'mailto:reply@example.org',
  },
};

let root = '';
let fromFiles: Corpus;
let fromService: Corpus;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'gab-parity-'));
  const manifest = join(root, 'manifest.json');
  await writeFile(manifest, JSON.stringify(MANIFEST));
  execFileSync(
    'node',
    ['packages/worker/src/main.ts', 'release', '--manifest', manifest, '--out', join(root, 'out')],
    { cwd: ROOT, stdio: 'pipe' },
  );
  const folder = join(root, 'out', `gab-release-${MANIFEST.date}`);
  const files = new Map<string, string>();
  for (const name of await readdir(folder))
    files.set(name, await readFile(join(folder, name), 'utf8'));
  fromFiles = corpusFromRelease(readSiteRelease(files), await loadRelationTypes());
  fromService = await loadCorpus();
}, 60_000);

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

test('the release holds entities to compare', () => {
  expect(fromFiles.entities.length).toBeGreaterThan(0);
});

// The release makes the public choice: a hidden entity, a hidden relation, a claim and a
// document that a licence keeps back. The read service gives the whole record, so it is cut down
// to what the release holds before the two are compared. What is left must be the same value, with
// the same sources, in the same order.
const withinRelease = (service: Corpus, files: Corpus): Corpus => {
  const entities = new Map(files.entities.map((one) => [one.id, one]));
  const relations = new Map(files.relations.map((one) => [one.id, one]));
  return {
    ...service,
    entities: service.entities.flatMap((one) => {
      const held = entities.get(one.id);
      return held === undefined
        ? []
        : [
            {
              ...one,
              attrs: Object.fromEntries(
                Object.entries(one.attrs)
                  .filter(([key]) => key in held.attrs)
                  .map(([key, value]) => [
                    key,
                    { ...value, src: value.src.filter((id) => held.attrs[key]?.src.includes(id)) },
                  ]),
              ),
              sources: one.sources.filter((id) => held.sources.includes(id)),
            },
          ];
    }),
    relations: service.relations.flatMap((one) => {
      const held = relations.get(one.id);
      return held === undefined
        ? []
        : [{ ...one, sources: one.sources.filter((id) => held.sources.includes(id)) }];
    }),
  };
};

// What a reader sees of an entity. The parts that write (the choices of a new link, the type
// chooser, the pending acts, the flag of an extraction) are hidden when the release is read, so
// they are not part of the page that is compared.
const pageOf = (corpus: Corpus, id: string, types: TypeVocabulary) => {
  const dossier = readDossier({ ...corpus, proposals: [] }, id, types, []);
  if (dossier === null) return null;
  // Departure: a release holds the own point of an entity and no precision word, so it cannot
  // borrow the point of a parent, and the map of a release draws own points only. It holds the
  // documents of each claim and no list for the row. So `drawnOnMap`, `positionFrom` and
  // `entitySources` are left out, as are the parts that write: the choices of a new link, the type
  // chooser, the pending acts and the flag of an extraction.
  return {
    entityId: dossier.entityId,
    label: dossier.label,
    type: dossier.type,
    proposedType: dossier.proposedType,
    decision: dossier.decision,
    rows: dossier.rows,
    relations: dossier.relations,
    sources: dossier.sources.map((card) => ({ ...card, extractable: false })),
  };
};

test('each entity page of the release is the page of the read service', async () => {
  const types = await loadEntityTypes();
  const pages = (corpus: Corpus) => fromFiles.entities.map((one) => pageOf(corpus, one.id, types));
  expect(pages(fromFiles)).toStrictEqual(pages(withinRelease(fromService, fromFiles)));
});

// A comparison of two empty pages passes, so the pages must hold something to compare.
test('the compared pages hold claims and relations', () => {
  const dossiers = fromFiles.entities.map((one) => pageOf(fromFiles, one.id, []));
  expect(dossiers.some((page) => (page?.rows.length ?? 0) > 0)).toBe(true);
  expect(dossiers.some((page) => (page?.relations.length ?? 0) > 0)).toBe(true);
});
