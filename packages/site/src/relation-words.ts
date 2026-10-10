import { SEEDED_RELATION_TYPES } from '@gab/proposal/relation-types';

const WORDS = new Map(SEEDED_RELATION_TYPES.map((one) => [one.key, one]));

/** The words of a relation type, read from its first end or from its second end. A type that the
 * list does not hold reads as its key with spaces. */
export const relationWords = (type: string, fromFarEnd: boolean): string => {
  const known = WORDS.get(type);
  if (known === undefined) return type.replaceAll('_', ' ');
  return fromFarEnd ? known.inverseLabel : known.label;
};
