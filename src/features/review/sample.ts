/** The sample this surface needs: two acts that contest one key, a deletion, an act that states
 * no confidence, and an act that cites a document the record does not hold. Every row is
 * invented. No claim here is about a real vessel, company or person. */

import type { Corpus, DocumentRow, Entity, Proposal, Relation } from '@/shared/read/model';

import { readQueue, type Change, type Subject } from './queue';

const TERMINAL = 'd41a7f38-2b90-4c15-8e6a-90f3b7c2d5e8';
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';
const COMPANY = '3f6b1e20-9a4c-4d51-8b77-1c2e5a9d0f31';
const ABSORBED = '9a3f28d1-4c67-4b02-85ea-7f1d6c3b9e04';

/** The three subjects a story names. They are one job with the rows below: the sample. */
export const SAMPLE = {
  /** Four acts, and two of them read one key. */
  contestedRow: TERMINAL,
  /** One act, and it destroys the row. */
  destroyedRow: VESSEL,
} as const;

const documents: readonly DocumentRow[] = [
  {
    id: 'manual',
    kind: 'manual',
    title: 'Direct entry by the analyst',
    uri: null,
    archiveUri: null,
    sha256: null,
    retrievedAt: null,
    admiralty: null,
    admiraltyOrigin: null,
  },
  {
    id: 'doc_8f2a41',
    kind: 'report',
    title: 'Port of Rotterdam — bulk cargo throughput, Q2 2026',
    uri: 'https://example.invalid/rotterdam/q2-2026.pdf',
    archiveUri: 'https://web.archive.example.invalid/2026/rotterdam-q2.pdf',
    sha256: '9f2b7c1d4e8a3506b1c9d7e2f4a86035c1d9e7b2f4a8603591c7d2e4f8a60351',
    retrievedAt: '2026-07-14',
    admiralty: 'B2',
    admiraltyOrigin: 'machine',
  },
  {
    id: 'doc_3c1104',
    kind: 'url',
    title: 'Corporate registry extract — Meridian Bulk Carriers Ltd',
    uri: 'https://example.invalid/registry/meridian-bulk',
    archiveUri: 'https://web.archive.example.invalid/2026/registry-meridian',
    sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    retrievedAt: '2026-06-02',
    admiralty: 'A1',
    admiraltyOrigin: 'human',
  },
  {
    id: 'doc_9b0417',
    kind: 'file',
    title: 'Vessel movement log, scanned',
    uri: null,
    archiveUri: null,
    sha256: 'c7d2e4f8a60351a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6071829',
    retrievedAt: '2026-05-21',
    admiralty: 'D4',
    admiraltyOrigin: 'arbitrated',
  },
  {
    // An unrated document. Invariant 6 pairs the rating with its origin, so both are absent.
    id: 'doc_5e7730',
    kind: 'url',
    title: 'Trade press article, unverified',
    uri: 'https://example.invalid/press/bulk-market-note',
    archiveUri: 'https://web.archive.example.invalid/2026/bulk-market-note',
    sha256: '0718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6',
    retrievedAt: '2026-07-30',
    admiralty: null,
    admiraltyOrigin: null,
  },
];

const entities: readonly Entity[] = [
  {
    id: TERMINAL,
    type: 'facility',
    proposedType: null,
    label: 'Maasvlakte bulk terminal, berth 7',
    attrs: {
      coal_stock_t: { v: 240000, src: ['doc_8f2a41'] },
      operator_confirmed: { v: true, src: ['doc_8f2a41'] },
    },
    sources: ['doc_8f2a41'],
    geom: { lon: 4.0361, lat: 51.9553 },
    promotedFrom: 'b2c1d4e5-0003-4a11-9c33-77e1f2a3b4c5',
  },
  {
    id: VESSEL,
    type: 'vessel',
    proposedType: null,
    label: 'MV Northern Ledger',
    attrs: {
      imo: { v: '9482137', src: ['doc_9b0417'] },
      // A flat list value. M7 permits a list of scalars and nothing nested.
      known_flags: { v: ['PA', 'MN'], src: ['doc_9b0417', 'doc_8f2a41'] },
      // Hand entered by the analyst. M8 makes `manual` a real document.
      hull_note: { v: 'Repainted funnel, photographed 2026-05', src: ['manual'] },
    },
    sources: ['doc_9b0417', 'manual'],
    geom: { lon: 4.4777, lat: 51.9244 },
    promotedFrom: 'b2c1d4e5-0002-4a11-9c33-77e1f2a3b4c5',
  },
  {
    id: COMPANY,
    type: 'company',
    proposedType: null,
    label: 'Meridian Bulk Carriers Ltd',
    attrs: {
      registration_number: { v: 'HE 418822', src: ['doc_3c1104'] },
      incorporated_on: { v: '2011-03-09', src: ['doc_3c1104'] },
      beneficial_owner_count: { v: 3, src: ['doc_3c1104', 'doc_5e7730'] },
    },
    sources: ['doc_3c1104'],
    geom: null,
    promotedFrom: 'b2c1d4e5-0001-4a11-9c33-77e1f2a3b4c5',
  },
  {
    id: ABSORBED,
    type: 'company',
    proposedType: null,
    label: 'Northern Ledger Shipping SA',
    attrs: {
      registration_number: { v: 'PA 1552-9014', src: ['doc_5e7730'] },
    },
    sources: ['doc_5e7730'],
    geom: null,
    promotedFrom: 'b2c1d4e5-0005-4a11-9c33-77e1f2a3b4c5',
  },
];

/** No act of this sample names a link, so a link would reach no screen the stories read. */
const relations: readonly Relation[] = [];

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

export const reviewSample: Corpus = { documents, entities, relations, proposals };

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
