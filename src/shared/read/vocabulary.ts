// The two closed lists the database declares: the types of an entity and of a relation. No canvas
// reads a hue or a name out of a position in a list, and no surface words a relation from its key.
// AN ATTRIBUTE KEY HAS NO VOCABULARY (M11), so nothing is loaded for one.
// With the read service down, the lists are the ones the seed declares: a release carries no
// type table, and a type it uses is one of these words or reads as its key.

import { SEEDED_RELATION_TYPES } from '@gab/proposal/relation-types';

import { seededVocabulary } from '@/shared/vocabulary/declarations';

import { readRows } from './http';
import { toDomain } from './map';
import type { RelationTypeVocabulary, TypeVocabulary } from './model';
import { readOnce } from './once';
import { readFrom } from './read-mode';

const seededEntityTypes: TypeVocabulary = seededVocabulary.entityTypes.map(
  ({ key, label, colourLight, colourDark }) => ({
    key,
    label,
    colourLight,
    colourDark,
    retired: seededVocabulary.retiredWhenSeeded,
  }),
);

const seededRelationTypes: RelationTypeVocabulary = SEEDED_RELATION_TYPES.map((one) => ({
  ...one,
  retired: false,
}));

// Every row, and never `retired=is.false`: a type leaves service through that flag, and the rows
// promoted under it keep the word. A live vocabulary that dropped it would leave those rows with
// no declared hue and no declared name.
const entityTypes = readOnce<TypeVocabulary>(() =>
  readFrom(
    async () => {
      const rows = await readRows('entity_type');
      return rows.map((row) => toDomain.entityType(row));
    },
    () => Promise.resolve(seededEntityTypes),
  ),
);

// Every row, for the same reason: a relation promoted under a retired word still needs its words.
const relationTypes = readOnce<RelationTypeVocabulary>(() =>
  readFrom(
    async () => {
      const rows = await readRows('relation_type');
      return rows.map((row) => toDomain.relationType(row));
    },
    () => Promise.resolve(seededRelationTypes),
  ),
);

export const loadEntityTypes = entityTypes.load;
export const loadRelationTypes = relationTypes.load;

/** Forget both lists. A retry asks the service again, so a list that the seed gave is not kept. */
export function forgetVocabulary(): void {
  entityTypes.forget();
  relationTypes.forget();
}
