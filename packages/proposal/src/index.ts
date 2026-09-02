// The three states of a proposal. The database holds the same three words in a check constraint,
// the browser filters on one of them, and the writer stamps one on a decision.
export const PROPOSAL_STATUS = {
  pending: 'pending',
  accepted: 'accepted',
  rejected: 'rejected',
} as const;

export type ProposalStatus = (typeof PROPOSAL_STATUS)[keyof typeof PROPOSAL_STATUS];
