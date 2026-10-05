// The gate of the one declaration. It reads the committed seed, emits the marked region again,
// and refuses a file that a hand edited. It opens no socket, so it runs on every machine.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';

import { SEEDED_RELATION_TYPES } from '../packages/proposal/src/relation-types.ts';
import { seededVocabulary } from '../src/shared/vocabulary/declarations.ts';
import { seedWithVocabulary } from './seed-vocabulary.ts';

const SEED = join(import.meta.dirname, '..', 'db', 'apply', '95_seed.sql');

test('the seed states the rows the declaration module declares', async () => {
  const committed = await readFile(SEED, 'utf8');
  expect(seedWithVocabulary(committed, seededVocabulary.entityTypes, SEEDED_RELATION_TYPES)).toBe(
    committed,
  );
});
