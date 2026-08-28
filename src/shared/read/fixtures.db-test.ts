// The two hand-written fixtures against the live vocabularies. A story reaches no database, so
// each fixture states the seed by hand, and nothing else compares the two. A story that draws a
// hue or a name the database does not declare proves nothing.

import { expect, test } from 'vitest';

import { entityTypes } from '../fixtures/entity-types';
import { vocabulary } from '../fixtures/vocabulary';
import type { AttributeDeclaration, EntityTypeDeclaration } from './model';
import { loadEntityTypes, loadVocabulary } from './vocabulary';

const byKey = <T extends { readonly key: string }>(rows: readonly T[]): ReadonlyMap<string, T> =>
  new Map(rows.map((row) => [row.key, row]));

test('the fixture types state what entity_type declares', async () => {
  const live = byKey<EntityTypeDeclaration>(await loadEntityTypes());

  // Every live type, and not a subset: a canvas takes the hue of each type it draws from here,
  // and a type the fixture omits would draw as a fault on a story and as itself in the browser.
  expect([...byKey(entityTypes).keys()].sort()).toStrictEqual([...live.keys()].sort());

  for (const held of entityTypes) {
    expect({ key: held.key, row: held }).toStrictEqual({ key: held.key, row: live.get(held.key) });
  }
});

test('the fixture vocabulary states what attribute_key declares', async () => {
  const live = byKey<AttributeDeclaration>(await loadVocabulary());

  expect([...byKey(vocabulary).keys()].sort()).toStrictEqual([...live.keys()].sort());

  for (const held of vocabulary) {
    expect({ key: held.key, row: held }).toStrictEqual({ key: held.key, row: live.get(held.key) });
  }
});
