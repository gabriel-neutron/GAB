// The two vocabularies of the record: the keys a claim may carry, and the types an entity may
// take. One job, because each is a closed list the database declares, and each is why no surface
// reads a kind, a name or a hue out of a value or out of a position in a list.

import { readRows } from './http';
import { toDomain } from './map';
import type { TypeVocabulary, Vocabulary } from './model';

/** The read runs once, and a failure clears the memory: a rejected promise that stayed would
 * answer every later attempt with the first failure. */
function held<T>(read: () => Promise<T>): () => Promise<T> {
  let reading: Promise<T> | null = null;
  return () => {
    reading ??= read().catch((reason: unknown) => {
      reading = null;
      throw reason;
    });
    return reading;
  };
}

export const loadVocabulary = held<Vocabulary>(async () => {
  const rows = await readRows('attribute_key');
  return rows.map((row) => toDomain.attributeKey(row));
});

// Every row, and never `retired=is.false`: a type leaves service through that flag, and the rows
// promoted under it keep the word. A live vocabulary that dropped it would leave those rows with
// no declared hue and no declared name.
export const loadEntityTypes = held<TypeVocabulary>(async () => {
  const rows = await readRows('entity_type');
  return rows.map((row) => toDomain.entityType(row));
});
