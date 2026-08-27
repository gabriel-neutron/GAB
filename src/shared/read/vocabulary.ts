// The attribute vocabulary, read once and held. It is the one authority on the kind of a key,
// so no surface reads a type out of the shape of a value.

import { readRows } from './http';
import { toDomain } from './map';
import type { Vocabulary } from './model';

let reading: Promise<Vocabulary> | null = null;

/** The read runs once, and a failure clears the memory: a rejected promise that stayed would
 * answer every later attempt with the first failure. */
export function loadVocabulary(): Promise<Vocabulary> {
  reading ??= readRows('attribute_key')
    .then((rows) => rows.map((row) => toDomain.attributeKey(row)))
    .catch((reason: unknown) => {
      reading = null;
      throw reason;
    });
  return reading;
}
