/**
 * **PROTOTYPE-ONLY. This is not the corpus, and it is not a change to the corpus.**
 *
 * `@/shared/fixtures/corpus` carries at most **one** pending proposal per node. The operator's
 * question on 11 August 2026 is what a node with ten pending changes looks like, and the shared
 * sample cannot show it. These rows exist so that the screen can be judged, and they live here
 * rather than in `shared/` because three other prototypes read that file and none of them asked
 * for this.
 *
 * **This is a finding, not a fix.** A sample that cannot produce two pending changes on one node
 * cannot test the review surface, and C7-VALIDATE (#8) asks the same question of the real v1
 * corpus. Reported.
 *
 * Every row is invented, in the same shape as the shared fixture, and it is deleted with the
 * prototype.
 */

import type { AgentCall, Proposal } from '@/shared/fixtures/types';

const BERTH_7 = 'd41a7f38-2b90-4c15-8e6a-90f3b7c2d5e8';
const NORTHERN_LEDGER = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';
const BERTHED_AT = 'c3d4e5f6-9a0b-4123-c456-d7e8f90a1b2c';
const EXTRACTOR_V4 = 'a9e70001-0000-4000-8000-000000000002';

export const extraProposals: readonly Proposal[] = [
  {
    // Low confidence, no dissent. A second change on a node that already carries one.
    id: 'aa000001-0000-4000-8000-000000000001',
    op: 'update_attrs',
    targetKind: 'entity',
    targetId: BERTH_7,
    payload: { kind: 'attrs', attrs: { operator_confirmed: { v: false, src: ['doc_5e7730'] } } },
    src: ['doc_5e7730'],
    confidence: 0.38,
    dissent: false,
    authorRole: 'gabriel_agent',
    status: 'pending',
    callId: 'cb220001-0000-4000-8000-000000000001',
    createdAt: '2026-08-06T10:20:00Z',
    decidedAt: null,
    decidedBy: null,
  },
  {
    // High confidence, no dissent. The #42 gap, inside a node that also carries routed changes.
    id: 'aa000001-0000-4000-8000-000000000002',
    op: 'update_attrs',
    targetKind: 'entity',
    targetId: BERTH_7,
    payload: { kind: 'attrs', attrs: { berth_length_m: { v: 340, src: ['doc_8f2a41'] } } },
    src: ['doc_8f2a41'],
    confidence: 0.94,
    dissent: false,
    authorRole: 'gabriel_agent',
    status: 'pending',
    callId: 'cb220001-0000-4000-8000-000000000002',
    createdAt: '2026-08-07T08:05:00Z',
    decidedAt: null,
    decidedBy: null,
  },
  {
    id: 'aa000001-0000-4000-8000-000000000003',
    op: 'update_attrs',
    targetKind: 'entity',
    targetId: BERTH_7,
    payload: { kind: 'attrs', attrs: { last_survey: { v: '2026-06-11', src: ['doc_9b0417'] } } },
    src: ['doc_9b0417'],
    confidence: 0.55,
    dissent: true,
    authorRole: 'gabriel_agent',
    status: 'pending',
    callId: 'cb220001-0000-4000-8000-000000000003',
    createdAt: '2026-08-08T13:40:00Z',
    decidedAt: null,
    decidedBy: null,
  },
  {
    // A deletion. The sample has none, so no screen could show what one looks like.
    id: 'aa000001-0000-4000-8000-000000000004',
    op: 'delete_relation',
    targetKind: 'relation',
    targetId: BERTHED_AT,
    payload: {
      kind: 'delete',
      reason: 'The movement log places the vessel at berth 9, not berth 7, on that date.',
    },
    src: ['doc_9b0417'],
    confidence: 0.44,
    dissent: false,
    authorRole: 'gabriel_agent',
    status: 'pending',
    callId: 'cb220001-0000-4000-8000-000000000004',
    createdAt: '2026-08-09T09:15:00Z',
    decidedAt: null,
    decidedBy: null,
  },
  {
    id: 'aa000001-0000-4000-8000-000000000005',
    op: 'update_attrs',
    targetKind: 'entity',
    targetId: NORTHERN_LEDGER,
    payload: {
      kind: 'attrs',
      attrs: { known_flags: { v: ['PA', 'MN', 'LR'], src: ['doc_8f2a41'] } },
    },
    src: ['doc_8f2a41'],
    confidence: 0.71,
    dissent: true,
    authorRole: 'gabriel_agent',
    status: 'pending',
    callId: 'cb220001-0000-4000-8000-000000000005',
    createdAt: '2026-08-09T16:02:00Z',
    decidedAt: null,
    decidedBy: null,
  },
];

const PREAMBLE =
  'Read the document. Return every company, vessel, facility and person. Cite the document ' +
  'for each attribute. Do not infer a value that the text does not carry.\n\n';

export const extraAgentCalls: readonly AgentCall[] = [
  {
    id: 'cb220001-0000-4000-8000-000000000001',
    runId: '4e110001-0000-4000-8000-000000000005',
    agentId: EXTRACTOR_V4,
    ord: 1,
    renderedPrompt:
      PREAMBLE +
      'Context (doc_5e7730): "The operator of berth 7 could not be confirmed at the close of ' +
      'the quarter."',
    createdAt: '2026-08-06T10:20:00Z',
  },
  {
    id: 'cb220001-0000-4000-8000-000000000002',
    runId: '4e110001-0000-4000-8000-000000000005',
    agentId: EXTRACTOR_V4,
    ord: 2,
    renderedPrompt:
      PREAMBLE +
      'Context (doc_8f2a41): "Berth 7 offers 340 metres of quay at 16.5 metres draught."',
    createdAt: '2026-08-07T08:05:00Z',
  },
  {
    id: 'cb220001-0000-4000-8000-000000000003',
    runId: '4e110001-0000-4000-8000-000000000005',
    agentId: EXTRACTOR_V4,
    ord: 3,
    renderedPrompt:
      PREAMBLE + 'Context (doc_9b0417): "Last hydrographic survey of the berth: June 2026."',
    createdAt: '2026-08-08T13:40:00Z',
  },
  {
    id: 'cb220001-0000-4000-8000-000000000004',
    runId: '4e110001-0000-4000-8000-000000000006',
    agentId: EXTRACTOR_V4,
    ord: 1,
    renderedPrompt:
      PREAMBLE +
      'Context (doc_9b0417): "MV NORTHERN LEDGER, IMO 9482137, alongside berth 9 on 19 May."',
    createdAt: '2026-08-09T09:15:00Z',
  },
  {
    id: 'cb220001-0000-4000-8000-000000000005',
    runId: '4e110001-0000-4000-8000-000000000006',
    agentId: EXTRACTOR_V4,
    ord: 2,
    renderedPrompt:
      PREAMBLE +
      'Context (doc_8f2a41): "The vessel has also been recorded under the Liberian flag."',
    createdAt: '2026-08-09T16:02:00Z',
  },
];
