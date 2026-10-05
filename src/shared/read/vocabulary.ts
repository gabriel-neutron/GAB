// The two closed lists the database declares: the types of an entity and of a relation. No canvas
// reads a hue or a name out of a position in a list, and no surface words a relation from its key.
// AN ATTRIBUTE KEY HAS NO VOCABULARY (M11), so nothing is loaded for one.

import { readRows } from './http';
import { toDomain } from './map';
import type { RelationTypeVocabulary, TypeVocabulary } from './model';
import { readOnce } from './once';

// Every row, and never `retired=is.false`: a type leaves service through that flag, and the rows
// promoted under it keep the word. A live vocabulary that dropped it would leave those rows with
// no declared hue and no declared name.
export const loadEntityTypes = readOnce<TypeVocabulary>(async () => {
  const rows = await readRows('entity_type');
  return rows.map((row) => toDomain.entityType(row));
}).load;

// Every row, for the same reason: a relation promoted under a retired word still needs its words.
export const loadRelationTypes = readOnce<RelationTypeVocabulary>(async () => {
  const rows = await readRows('relation_type');
  return rows.map((row) => toDomain.relationType(row));
}).load;
