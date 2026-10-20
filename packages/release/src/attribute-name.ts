import { keyWords } from '@gab/proposal/key-words';

/** The readable name of an attribute key: the label of the shared table, or the fixed rule of
 * the labels for a key that the table does not hold. */
export const attributeName = (key: string): string => keyWords(key).label;
