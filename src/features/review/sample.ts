/** The acts this surface needs: two that contest one key, a deletion, one that states no
 * confidence, and one that cites a document the record does not hold. Every row they name is a
 * row of the shared corpus, because a second copy is a second description of one record. */

import { corpus } from '@/shared/committed-fixture/corpus';
import type { Corpus, Proposal } from '@/shared/read/model';

import { readQueue, type Change, type Subject } from './queue';

const TERMINAL = 'd41a7f38-2b90-4c15-8e6a-90f3b7c2d5e8';
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';
const COMPANY = '3f6b1e20-9a4c-4d51-8b77-1c2e5a9d0f31';
const ABSORBED = '9a3f28d1-4c67-4b02-85ea-7f1d6c3b9e04';

/** The two subjects a story names. Each one is the target of an act below. */
export const SAMPLE = {
  /** Four acts, and two of them read one key. */
  contestedRow: TERMINAL,
  /** One act, and it destroys the row. */
  destroyedRow: VESSEL,
} as const;

// NO ACT BELOW NAMES A LINK, so the queue draws no link subject, and the relations of the corpus
// reach no screen a story reads. An act on a relation belongs here on the day one is drawn.
const proposals: readonly Proposal[] = [
  {
    // Dissent. S3 sends it to review whatever the confidence is.
    id: 'f0a1b2c3-4d5e-4678-9012-3456789abcde',
    op: 'update_attrs',
    targetKind: 'entity',
    targetId: TERMINAL,
    payload: {
      kind: 'attrs',
      attrs: { coal_stock_t: { v: 261500, src: ['doc_5e7730'] } },
    },
    src: ['doc_5e7730'],
    names: [],
    priorValue: { kind: 'attrs', attrs: { coal_stock_t: { v: 248000, src: ['doc_3c1104'] } } },
    confidence: 0.82,
    dissent: true,
    authorRole: 'gabriel_agent',
    status: 'pending',
    createdAt: '2026-08-03T09:12:00Z',
    decidedAt: null,
    decidedBy: null,
  },
  {
    // The second reading of one key, from a second document. It contests the act above.
    id: 'aa000001-0000-4000-8000-000000000001',
    op: 'update_attrs',
    targetKind: 'entity',
    targetId: TERMINAL,
    payload: { kind: 'attrs', attrs: { coal_stock_t: { v: 194200, src: ['doc_8f2a41'] } } },
    src: ['doc_8f2a41'],
    names: [],
    priorValue: null,
    confidence: 0.55,
    dissent: true,
    authorRole: 'gabriel_agent',
    status: 'pending',
    createdAt: '2026-08-05T07:20:00Z',
    decidedAt: null,
    decidedBy: null,
  },
  {
    // A third act on the same row, on a key that does not stand. It is not contested.
    id: 'aa000001-0000-4000-8000-000000000002',
    op: 'update_attrs',
    targetKind: 'entity',
    targetId: TERMINAL,
    payload: { kind: 'attrs', attrs: { berth_length_m: { v: 340, src: ['doc_3c1104'] } } },
    src: ['doc_3c1104'],
    names: [],
    priorValue: null,
    confidence: 0.94,
    dissent: false,
    authorRole: 'gabriel_agent',
    status: 'pending',
    createdAt: '2026-08-06T11:02:00Z',
    decidedAt: null,
    decidedBy: null,
  },
  {
    // The fourth act of the node, and the only one that states no confidence. A card must say
    // that the machine reported none, and never draw it as a low score.
    id: 'aa000001-0000-4000-8000-000000000004',
    op: 'update_attrs',
    targetKind: 'entity',
    targetId: TERMINAL,
    payload: { kind: 'attrs', attrs: { quay_depth_m: { v: 14.5, src: ['doc_3c1104'] } } },
    src: ['doc_3c1104'],
    names: [],
    priorValue: null,
    confidence: null,
    dissent: false,
    authorRole: 'gabriel_agent',
    status: 'pending',
    createdAt: '2026-08-07T08:15:00Z',
    decidedAt: null,
    decidedBy: null,
  },
  {
    // A deletion, so a screen can draw what an act destroys key by key.
    id: 'aa000001-0000-4000-8000-000000000003',
    op: 'delete_entity',
    targetKind: 'entity',
    targetId: VESSEL,
    payload: {
      kind: 'delete',
      reason: 'The registry entry names a hull that was broken up in 2019',
    },
    src: ['doc_9b0417'],
    names: [],
    priorValue: null,
    confidence: 0.38,
    dissent: false,
    authorRole: 'gabriel_agent',
    status: 'pending',
    createdAt: '2026-08-02T05:44:00Z',
    decidedAt: null,
    decidedBy: null,
  },
  {
    // An act that cites a document the record does not hold. The screen states it, never hides it.
    id: 'aa000001-0000-4000-8000-000000000005',
    op: 'merge_entities',
    targetKind: null,
    targetId: null,
    payload: {
      kind: 'merge',
      keep_id: COMPANY,
      merge_ids: [ABSORBED],
    },
    src: ['doc_0000ff'],
    names: [],
    priorValue: null,
    confidence: 0.71,
    dissent: false,
    authorRole: 'gabriel_agent',
    status: 'pending',
    createdAt: '2026-08-01T09:00:00Z',
    decidedAt: null,
    decidedBy: null,
  },
];

export const reviewSample: Corpus = { ...corpus, proposals };

/** A story reads the derivation the route reads, so it never draws a shape it cannot produce. */
export function sampleSubject(id: string): Subject {
  const held = readQueue(reviewSample, null).find((subject) => subject.id === id);
  if (held === undefined) throw new Error(`No subject ${id} waits in the review sample.`);
  return held;
}

/** The weakest act of a subject, which is the one the queue opens on. */
export function sampleChange(id: string): Change {
  const [held] = sampleSubject(id).changes;
  if (held === undefined) throw new Error(`The subject ${id} stands with no act under it.`);
  return held;
}
