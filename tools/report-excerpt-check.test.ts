import { expect, test } from 'vitest';

import { checkReport, holds, noteIdentifiers, notesOf, plainName } from './report-excerpt-check.ts';

const claim = (over: Record<string, string>) => ({
  claim_id: '',
  claim_kind: 'relation',
  subject_id: '',
  attribute: '',
  value: '',
  relation_type: '',
  object_id: '',
  object_label: '',
  document_id: 'doc_1',
  excerpt: '',
  ...over,
});

const files = {
  entities: [
    { id: 'port', label: 'Port of Primorsk' },
    { id: 'ship', label: 'ACHILLES' },
    { id: 'act', label: 'Council Regulation (EU) 2025/395' },
  ],
  relations: [],
  claims: [
    claim({
      claim_id: 'c1',
      subject_id: 'port',
      relation_type: 'restricted_by',
      object_id: 'act',
      excerpt: '4. Primorsk Article 5ae(1)',
    }),
    claim({
      claim_id: 'c2',
      subject_id: 'ship',
      relation_type: 'loads_at',
      object_id: 'port',
      document_id: 'doc_2',
      excerpt: '| Vessel | Load port |',
    }),
    claim({
      claim_id: 'c3',
      claim_kind: 'attribute',
      subject_id: 'ship',
      attribute: 'imo',
      value: '9123456',
      document_id: 'doc_3',
      excerpt: 'IMO 9123456',
    }),
  ],
};

const node = (id: string, entity: string, extra: Record<string, string> = {}) => ({
  node_id: id,
  record_entity_id: entity,
  name: '',
  short_label: '',
  cond1_sanctions_state: '',
  cond1_doc: '',
  ...extra,
});

test('a condition passes when an excerpt names the node by its short label, and an edge fails when no excerpt names both ends', () => {
  const checks = checkReport(files, {
    nodes: [
      node('N-1', 'port', {
        short_label: 'Primorsk',
        cond1_sanctions_state: 'record',
        cond1_doc: 'doc_1',
      }),
      node('N-2', 'ship'),
      node('N-3', 'gone'),
    ],
    edges: [
      {
        source: 'N-2',
        target: 'N-1',
        relation_type: 'loads_at',
        state: 'promoted fact',
        document_ids: 'doc_2',
      },
    ],
    notes: new Map([['7', 'The vessel IMO 9123456 (UK list, RUS9999).']]),
    noteDocuments: new Map([['7', ['doc_3']]]),
  });
  const verdict = (fact: string, ref: string) =>
    checks
      .filter((one) => one.fact === fact && one.ref === ref)
      .map((one) => `${one.verdict} ${one.reason}`);
  expect(verdict('node_entry', 'N-1')).toEqual(['pass an excerpt names the entity']);
  expect(verdict('condition', 'N-1/cond1')).toEqual(['pass an excerpt states the claim']);
  expect(verdict('node_entry', 'N-2')).toEqual(['pass an excerpt names the entity']);
  expect(verdict('node_entry', 'N-3')).toEqual(['fail entity_not_in_release']);
  expect(verdict('edge', 'N-2>N-1')).toEqual(['fail no_excerpt_names_both_ends']);
  expect(verdict('note', '7')).toEqual([
    'pass an excerpt holds 9123456',
    'fail identifier_not_in_excerpt:RUS9999',
  ]);
});

test('the sanctions condition fails when only a claim that is no link to an act cites its document', () => {
  const checks = checkReport(files, {
    nodes: [node('N-2', 'ship', { cond1_sanctions_state: 'record', cond1_doc: 'doc_3' })],
    edges: [],
    notes: new Map([['8', 'IMO 91234567 is no number of seven digits.']]),
    noteDocuments: new Map([['8', ['doc_3']]]),
  });
  expect(checks.filter((one) => one.fact !== 'node_entry').map((one) => one.reason)).toEqual([
    'no_claim_of_the_node_cites_the_document',
  ]);
});

test('reads the identifiers and the notes of the text', () => {
  expect(noteIdentifiers('Reg. (EU) No 833/2014, IMO 9876543, RUS1126')).toEqual([
    '833/2014',
    '9876543',
    'RUS1126',
  ]);
  expect([...notesOf('Text.[^4]\n\n[^4]: A note.\n')]).toEqual([['4', 'A note.']]);
});

test('a name holds in any case at a word edge, and a short value does not hold inside a word', () => {
  expect(holds('128. PJSC SOVCOMFLOT', 'Sovcomflot')).toBe(true);
  expect(holds('Russian Federation', 'RU')).toBe(false);
  expect(holds('flag: RU', 'ru')).toBe(true);
});

test('a condition reads each of its documents, and two excerpts of one page read together only with an identifier', () => {
  const twoPages = {
    entities: [
      { id: 'ship', label: 'KAROL' },
      { id: 'firm', label: 'TEST MANAGER LLC' },
      { id: 'other', label: 'OTHER LTD' },
    ],
    relations: [],
    claims: [
      claim({
        claim_id: 'i',
        claim_kind: 'attribute',
        subject_id: 'ship',
        attribute: 'imo',
        value: '9327413',
        document_id: 'doc_9',
        excerpt: 'IMO 9327413',
      }),
      claim({
        claim_id: 'r',
        subject_id: 'firm',
        relation_type: 'operates',
        object_id: 'ship',
        document_id: 'doc_8',
        excerpt: 'IMO 9327413',
      }),
      claim({
        claim_id: 'r',
        subject_id: 'firm',
        relation_type: 'operates',
        object_id: 'ship',
        document_id: 'doc_8',
        excerpt: 'Manager: TEST MANAGER LLC',
      }),
      claim({
        claim_id: 'o',
        subject_id: 'other',
        relation_type: 'owns',
        object_id: 'firm',
        document_id: 'doc_7',
        excerpt: 'OTHER LTD',
      }),
      claim({
        claim_id: 'o',
        subject_id: 'other',
        relation_type: 'owns',
        object_id: 'firm',
        document_id: 'doc_7',
        excerpt: 'TEST MANAGER LLC',
      }),
    ],
  };
  const checks = checkReport(twoPages, {
    nodes: [
      node('N-1', 'firm', {
        cond2_active_state: 'record',
        cond2_doc: 'doc_5; doc_8',
        cond3_third_country_state: 'record',
        cond3_doc: 'doc_7',
      }),
    ],
    edges: [],
    notes: new Map(),
    noteDocuments: new Map(),
  });
  expect(
    checks.filter((one) => one.fact === 'condition').map((one) => `${one.ref} ${one.verdict}`),
  ).toEqual(['N-1/cond2 pass', 'N-1/cond3 fail']);
});

test('a name holds with no punctuation and no legal form, but never on a place alone', () => {
  expect(plainName('CJSC "Alfa-Bank" (Belarus)')).toBe('alfa bank belarus');
  expect(holds('BEL0166,,CJSC Alfa Bank Belarus', 'Alfa-Bank (Belarus)')).toBe(true);
  expect(holds('TSK VEKTOR, OOO', 'TSK Vektor')).toBe(true);
  expect(holds('Bank of Asia', 'Bank of Central Asia')).toBe(false);
  // A subsidiary is not its parent, and a country is not a bank.
  expect(holds('VTB Bank (PJSC) Shanghai Branch', 'VTB Bank (Kazakhstan)')).toBe(false);
  expect(holds('Exports to Kazakhstan rose', 'Sberbank (Kazakhstan)')).toBe(false);
  // A refinery is not its town.
  expect(holds('the Tuapse port was struck', 'Tuapse Refinery')).toBe(false);
});

test('a condition of a manager rests on a fact of a vessel that it operates', () => {
  const fleetFiles = {
    entities: [
      { id: 'mgr', label: 'TEST SHIPPING LLC', type: 'company' },
      { id: 'ship', label: 'KRUGER', type: 'vessel' },
      { id: 'act', label: 'Executive Order 14024', type: 'legal_act' },
    ],
    relations: [{ id: 'op', type: 'operates', from_id: 'mgr', to_id: 'ship' }],
    claims: [
      claim({
        claim_id: 'd',
        subject_id: 'ship',
        relation_type: 'designated_by',
        object_id: 'act',
        document_id: 'doc_4',
        excerpt: 'KRUGER (IMO 9123456) Vessel',
      }),
    ],
  };
  const checks = checkReport(fleetFiles, {
    nodes: [node('N-1', 'mgr', { cond1_sanctions_state: 'record', cond1_doc: 'doc_4' })],
    edges: [],
    notes: new Map(),
    noteDocuments: new Map(),
  });
  expect(checks.find((one) => one.ref === 'N-1/cond1')?.verdict).toBe('pass');
});

test('a value holds in the excerpt only, an event needs its place, and a page name counts', () => {
  const pages = {
    entities: [
      { id: 'ship', label: 'ALTURA', type: 'vessel' },
      { id: 'strike', label: 'strike — Tuapse — 2026-04-16', type: 'event' },
      { id: 'plant', label: 'Nizhny Novgorod refinery', type: 'facility' },
    ],
    relations: [],
    claims: [
      claim({
        claim_id: 'v',
        claim_kind: 'attribute',
        subject_id: 'ship',
        attribute: 'build_year',
        value: '2004',
        document_id: 'doc_6',
        excerpt: 'Built in a Korean yard',
        document_title: 'ALTURA 2004',
      }),
      claim({
        claim_id: 'e',
        subject_id: 'strike',
        relation_type: 'occurred_at',
        object_id: 'plant',
        document_id: 'doc_7',
        excerpt: 'Drones hit the Кстовский НПЗ at night',
      }),
    ],
  };
  const checks = checkReport(pages, {
    nodes: [
      node('N-1', 'ship', { cond2_active_state: 'record', cond2_doc: 'doc_6' }),
      node('N-2', 'plant', { cond2_active_state: 'record', cond2_doc: 'doc_7' }),
    ],
    edges: [],
    notes: new Map(),
    noteDocuments: new Map(),
  });
  const verdict = (ref: string) => checks.find((one) => one.ref === ref)?.verdict;
  expect(verdict('N-1/cond2')).toBe('fail');
  expect(verdict('N-2/cond2')).toBe('pass');
});
