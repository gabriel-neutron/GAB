import type { TypeVocabulary } from '@/shared/read/model';

import { seededVocabulary } from './vocabulary/declarations';
import { keyLabel } from '@gab/proposal/key-words';

const SEEDED = new Map(seededVocabulary.entityTypes.map((type) => [type.key, type.label]));

/** The label of an entity type. The list the caller holds comes first, then the seed. A key that
 * neither holds reads by the rule of the attribute keys, so no raw key shows. */
export function typeLabel(key: string, types?: TypeVocabulary): string {
  return types?.find((type) => type.key === key)?.label ?? SEEDED.get(key) ?? keyLabel(key);
}
