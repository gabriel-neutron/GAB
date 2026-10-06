import type { RelationTypeVocabulary } from './read/model';

/** The words of one relation type, read from its source and from its far end. */
export interface RelationWords {
  readonly label: string;
  readonly inverseLabel: string;
}

/** The words of each type, from the list the database declares. A key the list does not hold is
 * the word an act wrote and no live type carries, so it reads as the act wrote it: a formatter
 * would give it words that no row declares. */
export function relationWording(types: RelationTypeVocabulary): (key: string) => RelationWords {
  const byKey = new Map(types.map((type) => [type.key, type]));
  return (key) => {
    const held = byKey.get(key);
    return held === undefined
      ? { label: key, inverseLabel: key }
      : { label: held.label, inverseLabel: held.inverseLabel };
  };
}
