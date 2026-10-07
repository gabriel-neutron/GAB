import type { RelationTypeVocabulary, TypeVocabulary } from '@/shared/read/model';
import { relationWording } from '@/shared/relation-words';

import type { UnitWords } from './unit-changes';

/** The words of the two vocabularies that the database declares. A key that no row declares
 * reads as the act wrote it. */
export function unitWords(relations: RelationTypeVocabulary, entities: TypeVocabulary): UnitWords {
  const labels = new Map(entities.map((type) => [type.key, type.label]));
  return {
    relation: relationWording(relations),
    entityType: (key) => labels.get(key) ?? key,
  };
}
