import type { Proposer } from './read/model';

const WORDS: Readonly<Record<Proposer, string>> = {
  v1_import: 'v1 import',
  research_ai: 'research AI',
  extractor: 'extractor',
  operator: 'operator',
};

/** Who proposed an act, in the words of each page that shows it. */
export const proposerWords = (proposer: Proposer): string => WORDS[proposer];
