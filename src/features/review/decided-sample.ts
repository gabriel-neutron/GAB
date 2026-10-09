import type { DecidedAct } from './decided';

// A page of the decided acts as the writer gives it, for the tests and the stories: a group
// action, a rejection with its reason and note, and one unit promoted alone.

/** The decided acts of the sample, the latest decision first. */
export const DECIDED_SAMPLE: readonly DecidedAct[] = [
  {
    id: '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d',
    op: 'create_entity',
    proposer: 'v1_import',
    status: 'accepted',
    decidedAt: '2026-10-07T14:02:10Z',
    decidedBy: 'operator',
    decidedAs: 'group',
    decisionOrigin: null,
    decisionReason: null,
    rejectReason: null,
    rejectNote: null,
    name: '57th Separate Motor Rifle Brigade',
  },
  {
    id: '1c2d3e4f-5061-4b7c-9d8e-0f1a2b3c4d5e',
    op: 'create_entity',
    proposer: 'extractor',
    status: 'rejected',
    decidedAt: '2026-10-07T13:40:00Z',
    decidedBy: 'operator',
    decidedAs: 'unit',
    decisionOrigin: null,
    decisionReason: null,
    rejectReason: 'not_in_source',
    rejectNote: 'The page names the region, not a body.',
    name: 'North American countries',
  },
  {
    id: '2d3e4f50-7182-49ab-c234-56789abcdef0',
    op: 'create_entity',
    proposer: 'v1_import',
    status: 'accepted',
    decidedAt: '2026-10-07T09:12:44Z',
    decidedBy: 'operator',
    decidedAs: 'unit',
    decisionOrigin: null,
    decisionReason: null,
    rejectReason: null,
    rejectNote: null,
    name: '5th Combined Arms Army',
  },
];

/** One act that a rule accepted. */
export const RULE_DECIDED: DecidedAct = {
  id: '3e4f5061-8293-4abc-d345-6789abcdef01',
  op: 'create_entity',
  proposer: 'research_ai',
  status: 'accepted',
  decidedAt: '2026-10-08T08:00:00Z',
  decidedBy: 'rule strong_sources v1',
  decidedAs: 'rule',
  decisionOrigin: 'rule strong_sources v1 (fact digits: 1)',
  decisionReason: null,
  rejectReason: null,
  rejectNote: null,
  name: '12th Operational Command',
};

/** One act that an AI reviewer rejected, with its reason. */
export const AI_DECIDED: DecidedAct = {
  id: '4f506172-93a4-4bcd-e456-789abcdef012',
  op: 'create_entity',
  proposer: 'extractor',
  status: 'rejected',
  decidedAt: '2026-10-08T10:15:00Z',
  decidedBy: 'an AI reviewer, through the MCP server',
  decidedAs: 'unit',
  decisionOrigin: 'decided by an AI reviewer',
  decisionReason: 'The cited passage names the port, and no vessel of this name.',
  rejectReason: 'not_in_source',
  rejectNote: null,
  name: 'MV Baltic Star',
};
