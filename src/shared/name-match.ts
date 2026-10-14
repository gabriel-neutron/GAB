import { folded } from './text-fold';

export const nameHoldsQuery = (name: string, query: string): boolean =>
  folded(name).includes(folded(query));
