/** A word of the record that a reader meets on a screen and that the relation types do not
 * define. */
export interface GlossaryTerm {
  readonly term: string;
  readonly definition: string;
}

export const GLOSSARY_TERMS: readonly GlossaryTerm[] = [
  {
    term: 'Claim',
    definition:
      'One stated fact of the record, with the documents that support it. Each claim has its own page.',
  },
  {
    term: 'Pending proposal',
    definition:
      'A change that an agent or a person proposed and the operator did not decide yet. The page marks it as a proposal. It is not yet a fact of the record.',
  },
  {
    term: 'Hostile',
    definition:
      'An affiliation that the project gives to a military unit. It is the point of view of the project, not a legal finding.',
  },
];
