/**
 * A small sample corpus for the prototypes. **Synthetic, not the v1 corpus.**
 *
 * #8 C7-VALIDATE asks whether a sample of the **real** v1 entities is representable in the
 * target model, and it says to take the awkward ones. The v1 corpus is not in this repository,
 * so this file cannot answer #8. It prepares the answer: it is shaped like the model the
 * tracker decided, and the awkward cases below are the ones a real sample must also survive.
 *
 * Every row is invented. No claim here is about a real vessel, company or person.
 *
 * The awkward cases it carries on purpose:
 *
 * | Case | Why it is awkward |
 * |---|---|
 * | An attribute with two sources | S1: a rating change must reach every claim that cites it |
 * | An attribute sourced `manual` | M8 permits it for a hand-entered value; invariant 3 refuses it for a machine proposal |
 * | A relation whose endpoint is a relation | M4. Nothing supports it and nothing prevents it |
 * | An entity with no geometry | The map shows only what carries one |
 * | A dated ownership relation | M6 reserves an interval for identity and ownership |
 * | An unrated document | Invariant 6 pairs a rating with its origin, so both are absent together |
 * | A proposal with no dissent and high confidence | The gap S3 and P1 leave open — #42 |
 * | A rejected proposal | `spec.md` §5: never deleted, it is the record of what was set aside |
 * | Two versions of one agent | #16: the old prompt must still be readable |
 */

import type { Corpus } from './types';

export const corpus: Corpus = {
  documents: [
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
  ],

  entities: [
    {
      id: '3f6b1e20-9a4c-4d51-8b77-1c2e5a9d0f31',
      type: 'company',
      label: 'Meridian Bulk Carriers Ltd',
      attrs: {
        registration_number: { v: 'HE 418822', src: ['doc_3c1104'] },
        incorporated_on: { v: '2011-03-09', src: ['doc_3c1104'] },
        // Two sources on one attribute. S1 makes this the case that matters when a rating moves.
        beneficial_owner_count: { v: 3, src: ['doc_3c1104', 'doc_5e7730'] },
      },
      sources: ['doc_3c1104'],
      geom: null,
      promotedFrom: 'b2c1d4e5-0001-4a11-9c33-77e1f2a3b4c5',
    },
    {
      id: '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7',
      type: 'vessel',
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
      id: 'd41a7f38-2b90-4c15-8e6a-90f3b7c2d5e8',
      type: 'facility',
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
      id: '18e5c740-6a2b-4d93-b1f7-3c8d0e9a2b46',
      type: 'person',
      label: 'A. Vasilakis',
      attrs: {
        role_title: { v: 'Director', src: ['doc_3c1104'] },
      },
      sources: ['doc_3c1104'],
      geom: null,
      promotedFrom: 'b2c1d4e5-0004-4a11-9c33-77e1f2a3b4c5',
    },
    {
      id: '9a3f28d1-4c67-4b02-85ea-7f1d6c3b9e04',
      type: 'company',
      label: 'Northern Ledger Shipping SA',
      attrs: {
        registration_number: { v: 'PA 1552-9014', src: ['doc_5e7730'] },
      },
      sources: ['doc_5e7730'],
      geom: null,
      promotedFrom: 'b2c1d4e5-0005-4a11-9c33-77e1f2a3b4c5',
    },
  ],

  relations: [
    {
      id: 'e1f20a34-7b8c-4d16-9052-a3b4c5d6e7f8',
      type: 'owns',
      srcKind: 'entity',
      srcId: '9a3f28d1-4c67-4b02-85ea-7f1d6c3b9e04',
      dstKind: 'entity',
      dstId: '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7',
      attrs: {
        share_pct: { v: 100, src: ['doc_5e7730'] },
      },
      sources: ['doc_5e7730'],
      // M6 reserves an interval for an ownership relation.
      validFrom: '2019-04-01',
      validTo: null,
      promotedFrom: 'b2c1d4e5-0006-4a11-9c33-77e1f2a3b4c5',
    },
    {
      id: 'a2b3c4d5-8e9f-4012-b345-c6d7e8f90a1b',
      type: 'appoints',
      srcKind: 'entity',
      srcId: '3f6b1e20-9a4c-4d51-8b77-1c2e5a9d0f31',
      dstKind: 'entity',
      dstId: '18e5c740-6a2b-4d93-b1f7-3c8d0e9a2b46',
      attrs: {},
      sources: ['doc_3c1104'],
      validFrom: '2011-03-09',
      validTo: '2024-11-30',
      promotedFrom: 'b2c1d4e5-0007-4a11-9c33-77e1f2a3b4c5',
    },
    {
      id: 'c3d4e5f6-9a0b-4123-c456-d7e8f90a1b2c',
      type: 'berthed_at',
      srcKind: 'entity',
      srcId: '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7',
      dstKind: 'entity',
      dstId: 'd41a7f38-2b90-4c15-8e6a-90f3b7c2d5e8',
      attrs: {
        observed_on: { v: '2026-05-19', src: ['doc_9b0417'] },
      },
      sources: ['doc_9b0417'],
      validFrom: null,
      validTo: null,
      promotedFrom: 'b2c1d4e5-0008-4a11-9c33-77e1f2a3b4c5',
    },
    {
      // M4: an endpoint is a relation, not an entity. This one is invisible in the graph view
      // and is reached through the detail panel. ADR 0004 §4 says so.
      id: 'd4e5f60a-1b2c-4234-d567-e8f90a1b2c3d',
      type: 'contradicts',
      srcKind: 'entity',
      srcId: '3f6b1e20-9a4c-4d51-8b77-1c2e5a9d0f31',
      dstKind: 'relation',
      dstId: 'e1f20a34-7b8c-4d16-9052-a3b4c5d6e7f8',
      attrs: {
        note: { v: 'Registry names a different owner for the same period', src: ['doc_3c1104'] },
      },
      sources: ['doc_3c1104'],
      validFrom: null,
      validTo: null,
      promotedFrom: 'b2c1d4e5-0009-4a11-9c33-77e1f2a3b4c5',
    },
  ],

  proposals: [
    {
      // Dissent. S3 sends it to review whatever the confidence is.
      id: 'f0a1b2c3-4d5e-4678-9012-3456789abcde',
      op: 'update_attrs',
      targetKind: 'entity',
      targetId: 'd41a7f38-2b90-4c15-8e6a-90f3b7c2d5e8',
      payload: {
        kind: 'attrs',
        attrs: { coal_stock_t: { v: 261500, src: ['doc_5e7730'] } },
      },
      src: ['doc_5e7730'],
      confidence: 0.82,
      dissent: true,
      authorRole: 'gabriel_agent',
      status: 'pending',
      callId: 'ca110001-0000-4000-8000-000000000001',
      createdAt: '2026-08-03T09:12:00Z',
      decidedAt: null,
      decidedBy: null,
    },
    {
      // Low confidence, no dissent. S3 sends it to review on the second condition.
      id: '0b1c2d3e-5f60-4789-a012-3456789abcdf',
      op: 'create_relation',
      targetKind: null,
      targetId: null,
      payload: {
        kind: 'relation',
        type: 'operates',
        srcId: '3f6b1e20-9a4c-4d51-8b77-1c2e5a9d0f31',
        dstId: 'd41a7f38-2b90-4c15-8e6a-90f3b7c2d5e8',
      },
      src: ['doc_8f2a41'],
      confidence: 0.41,
      dissent: false,
      authorRole: 'gabriel_agent',
      status: 'pending',
      callId: 'ca110001-0000-4000-8000-000000000002',
      createdAt: '2026-08-04T14:38:00Z',
      decidedAt: null,
      decidedBy: null,
    },
    {
      // No dissent, high confidence. **This is the gap #42 must settle.** S3 does not send it
      // to review. P1 does not let it through. A prototype must show what it does with this
      // row, and must not decide it.
      id: '1c2d3e4f-6071-489a-b123-456789abcdef',
      op: 'create_entity',
      targetKind: null,
      targetId: null,
      payload: {
        kind: 'entity',
        type: 'company',
        label: 'Maasvlakte Terminal Services BV',
        attrs: { registration_number: { v: 'NL 6640112', src: ['doc_8f2a41'] } },
      },
      src: ['doc_8f2a41'],
      confidence: 0.96,
      dissent: false,
      authorRole: 'gabriel_agent',
      status: 'pending',
      callId: 'ca110001-0000-4000-8000-000000000003',
      createdAt: '2026-08-05T08:02:00Z',
      decidedAt: null,
      decidedBy: null,
    },
    {
      id: '2d3e4f50-7182-49ab-c234-56789abcdef0',
      op: 'create_entity',
      targetKind: null,
      targetId: null,
      payload: {
        kind: 'entity',
        type: 'vessel',
        label: 'MV Northern Ledger',
        attrs: { imo: { v: '9482137', src: ['doc_9b0417'] } },
      },
      src: ['doc_9b0417'],
      confidence: 0.91,
      dissent: false,
      authorRole: 'gabriel_agent',
      status: 'accepted',
      callId: 'ca110001-0000-4000-8000-000000000004',
      createdAt: '2026-07-22T11:45:00Z',
      decidedAt: '2026-07-22T16:20:00Z',
      decidedBy: 'operator',
    },
    {
      // Rejected, and kept. `spec.md` §5: the record of what was set aside.
      id: '3e4f5061-8293-4abc-d345-6789abcdef01',
      op: 'merge_entities',
      targetKind: 'entity',
      targetId: '9a3f28d1-4c67-4b02-85ea-7f1d6c3b9e04',
      payload: {
        kind: 'merge',
        keepId: '9a3f28d1-4c67-4b02-85ea-7f1d6c3b9e04',
        mergeIds: ['3f6b1e20-9a4c-4d51-8b77-1c2e5a9d0f31'],
      },
      src: ['doc_5e7730'],
      confidence: 0.73,
      dissent: true,
      authorRole: 'gabriel_agent',
      status: 'rejected',
      callId: 'ca110001-0000-4000-8000-000000000005',
      createdAt: '2026-07-19T10:05:00Z',
      decidedAt: '2026-07-19T18:41:00Z',
      decidedBy: 'operator',
    },
    {
      // Written by the operator, not by an agent. #15: an operator edit is a proposal too, and
      // the writing role is stamped and not stated by the caller. It may cite `manual`.
      id: '4f506172-93a4-4bcd-e456-789abcdef012',
      op: 'update_attrs',
      targetKind: 'entity',
      targetId: '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7',
      payload: {
        kind: 'attrs',
        attrs: { hull_note: { v: 'Repainted funnel, photographed 2026-05', src: ['manual'] } },
      },
      src: ['manual'],
      confidence: 1,
      dissent: false,
      authorRole: 'gabriel_app',
      status: 'accepted',
      callId: 'ca110001-0000-4000-8000-000000000006',
      createdAt: '2026-07-25T07:30:00Z',
      decidedAt: '2026-07-25T07:30:00Z',
      decidedBy: 'operator',
    },
  ],

  agents: [
    // Two versions of one agent. #16: the old prompt stays readable after the new one exists.
    {
      id: 'a9e70001-0000-4000-8000-000000000001',
      name: 'extractor',
      version: 3,
      role: 'extractor',
      model: 'model-placeholder',
      prompt: 'Read the document. Return every company, vessel, facility and person.',
      createdAt: '2026-06-10T09:00:00Z',
    },
    {
      id: 'a9e70001-0000-4000-8000-000000000002',
      name: 'extractor',
      version: 4,
      role: 'extractor',
      model: 'model-placeholder',
      prompt:
        'Read the document. Return every company, vessel, facility and person. Cite the ' +
        'document for each attribute. Do not infer a value that the text does not carry.',
      createdAt: '2026-07-28T09:00:00Z',
    },
    {
      id: 'a9e70001-0000-4000-8000-000000000003',
      name: 'critic',
      version: 1,
      role: 'critic',
      model: 'model-placeholder',
      prompt: 'Judge the proposal against the cited text. State a disagreement plainly.',
      createdAt: '2026-06-10T09:00:00Z',
    },
  ],

  agentCalls: [
    {
      id: 'ca110001-0000-4000-8000-000000000001',
      runId: '4e110001-0000-4000-8000-000000000001',
      agentId: 'a9e70001-0000-4000-8000-000000000002',
      ord: 1,
      renderedPrompt:
        'Read the document. Return every company, vessel, facility and person. Cite the ' +
        'document for each attribute. Do not infer a value that the text does not carry.\n\n' +
        'Context (doc_5e7730): "Terminal stocks were reported near 261 500 tonnes at the ' +
        'close of the quarter, against 240 000 in the official return."',
      createdAt: '2026-08-03T09:12:00Z',
    },
    {
      id: 'ca110001-0000-4000-8000-000000000002',
      runId: '4e110001-0000-4000-8000-000000000001',
      agentId: 'a9e70001-0000-4000-8000-000000000002',
      ord: 2,
      renderedPrompt:
        'Read the document. Return every company, vessel, facility and person. Cite the ' +
        'document for each attribute. Do not infer a value that the text does not carry.\n\n' +
        'Context (doc_8f2a41): "Berth 7 is worked under contract by the terminal services ' +
        'arm of the port group."',
      createdAt: '2026-08-04T14:38:00Z',
    },
    {
      id: 'ca110001-0000-4000-8000-000000000003',
      runId: '4e110001-0000-4000-8000-000000000002',
      agentId: 'a9e70001-0000-4000-8000-000000000002',
      ord: 1,
      renderedPrompt:
        'Read the document. Return every company, vessel, facility and person. Cite the ' +
        'document for each attribute. Do not infer a value that the text does not carry.\n\n' +
        'Context (doc_8f2a41): "Maasvlakte Terminal Services BV, registered NL 6640112, ' +
        'holds the operating concession for berths 5 to 9."',
      createdAt: '2026-08-05T08:02:00Z',
    },
    {
      // Produced by version 3, before the prompt was raised. #16 exists for this row.
      id: 'ca110001-0000-4000-8000-000000000004',
      runId: '4e110001-0000-4000-8000-000000000003',
      agentId: 'a9e70001-0000-4000-8000-000000000001',
      ord: 1,
      renderedPrompt:
        'Read the document. Return every company, vessel, facility and person.\n\n' +
        'Context (doc_9b0417): "MV NORTHERN LEDGER, IMO 9482137, alongside berth 7."',
      createdAt: '2026-07-22T11:45:00Z',
    },
    {
      id: 'ca110001-0000-4000-8000-000000000005',
      runId: '4e110001-0000-4000-8000-000000000003',
      agentId: 'a9e70001-0000-4000-8000-000000000003',
      ord: 2,
      renderedPrompt:
        'Judge the proposal against the cited text. State a disagreement plainly.\n\n' +
        'Proposal: merge Meridian Bulk Carriers Ltd into Northern Ledger Shipping SA.',
      createdAt: '2026-07-19T10:05:00Z',
    },
    {
      id: 'ca110001-0000-4000-8000-000000000006',
      runId: '4e110001-0000-4000-8000-000000000004',
      agentId: 'a9e70001-0000-4000-8000-000000000001',
      ord: 1,
      renderedPrompt: 'Entered by the analyst. No model was called.',
      createdAt: '2026-07-25T07:30:00Z',
    },
  ],
};
