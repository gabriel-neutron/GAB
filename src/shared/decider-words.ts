import type { DecisionMode } from './read/model';

/** Who decided an act, from the mode that the record keeps (S4). Only the operator decides, so an
 * older decision with no mode is the operator's too. */
export const deciderWords = (mode: DecisionMode | null): string =>
  mode === 'group' ? 'the operator, group action' : 'the operator';
