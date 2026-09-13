// What the committed fixture puts in an empty record. A database test reads this instead of a
// total, because a total is a statement about one machine and the load above the fixture varies.

import { corpus } from './corpus';

export const fixtureSize = {
  entities: corpus.entities.length,
  relations: corpus.relations.length,
  /** The deliberate examples of the fixture. No load settles one, and no load adds one. */
  pending: corpus.proposals.filter((act) => act.status === 'pending').length,
} as const;
