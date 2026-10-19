/** The label that a release gives to a fact that no rule and no person has checked. */
export const PROPOSED_LABEL = 'Proposed — not checked';

/** A fact is accepted when its label is not the label of a proposal. A fact accepted by a rule,
 * by an AI reviewer or by the operator is accepted. */
export const isAccepted = (originLabel: string): boolean => originLabel !== PROPOSED_LABEL;
