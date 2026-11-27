import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  claimsOf,
  dates,
  denyList,
  designationSource,
  duplicatesOf,
  excerptPresent,
  holdsIdentifier,
  identifiersOf,
  identifierValid,
  nodeChecks,
  nodeVerdict,
  recordChecks,
  sha256Of,
  valueInExcerpt,
  type Claim,
  type RecordReader,
} from './node-audit-checks.ts';
import { tunnelConnection, tunnelEnvText } from './record-tunnel-env.ts';
import {
  auditNode,
  auditOrder,
  citingNodes,
  contextOf,
  failedClaimsOf,
  repairTail,
  reportEntityIds,
  summaryOf,
} from './node-audit.ts';

type Row = Record<string, string>;

const VESSEL = 'v1';
const OWNER = 'c1';
const ACT = 'act1';

const cite = (over: Row): Row => ({
  claim_id: '',
  claim_kind: 'attribute',
  subject_id: VESSEL,
  subject_label: 'OCEAN STAR',
  attribute: '',
  value: '',
  relation_type: '',
  object_id: '',
  object_label: '',
  valid_from: '',
  valid_to: '',
  origin_label: 'Accepted by an AI reviewer — no person read it, on 2026-10-01',
  document_id: 'doc_a',
  document_address: 'https://ofac.treasury.gov/recent-actions/20250110',
  page: '1',
  excerpt: '',
  document_type: 'register_entry',
  nato_letter: 'A',
  value_in_excerpt: 'yes',
  ...over,
});

// A valid IMO number: 9 4 3 5 3 3 7 (check digit 7).
const ROWS: Row[] = [
  cite({
    claim_id: 'v1/imo',
    attribute: 'imo',
    value: '9435337',
    excerpt: 'Vessel IMO 9435337 (tanker)',
  }),
  cite({ claim_id: 'v1/flag', attribute: 'flag', value: 'Gabon', excerpt: 'flag of Gabon' }),
  cite({
    claim_id: 'v1/kind',
    attribute: 'asset_kind',
    value: 'export_terminal',
    excerpt: 'an oil port',
  }),
  cite({
    claim_id: 'r-des',
    claim_kind: 'relation',
    relation_type: 'designated_by',
    object_id: ACT,
    object_label: 'Executive Order 14024',
    excerpt: 'OCEAN STAR; IMO9435337; Vessel Registration Identification',
  }),
  cite({
    claim_id: 'r-own',
    claim_kind: 'relation',
    subject_id: OWNER,
    subject_label: 'Blue Ltd',
    relation_type: 'owns',
    object_id: VESSEL,
    object_label: 'OCEAN STAR',
    valid_from: '2024-03-01',
    excerpt: 'Blue Ltd is the registered owner of OCEAN STAR',
  }),
  cite({
    claim_id: `${ACT}/adopted_on`,
    subject_id: ACT,
    attribute: 'adopted_on',
    value: '2021-04-15',
    excerpt: 'Executive Order of April 15, 2021',
  }),
];

const ENTITIES: Row[] = [
  { id: VESSEL, type: 'vessel', label: 'OCEAN STAR' },
  { id: OWNER, type: 'company', label: 'Blue Ltd' },
  { id: ACT, type: 'legal_act', label: 'Executive Order 14024' },
  { id: 'p1', type: 'person', label: 'A Person' },
];

const RELATIONS: Row[] = [
  { id: 'r-des', type: 'designated_by', from_id: VESSEL, to_id: ACT, valid_from: '', valid_to: '' },
  {
    id: 'r-own',
    type: 'owns',
    from_id: OWNER,
    to_id: VESSEL,
    valid_from: '2024-03-01',
    valid_to: '',
  },
];

const FILES = { entities: ENTITIES, relations: RELATIONS, claims: ROWS };

const claims = claimsOf(ROWS);
const identifiers = identifiersOf(claims.values());
const one = (id: string): Claim => {
  const found = claims.get(id);
  if (found === undefined) throw new Error(id);
  return found;
};
const with_ = (id: string, over: Row): Claim => ({
  ...one(id),
  citations: one(id).citations.map((row) => ({ ...row, ...over })),
});

describe('the checks of a fact', () => {
  it('fails a claim with no excerpt', () => {
    expect(excerptPresent(one('v1/flag')).verdict).toBe('pass');
    expect(excerptPresent(with_('v1/flag', { excerpt: ' ' })).verdict).toBe('fail');
  });

  it('finds the value in the excerpt, and fails a value that it does not hold', () => {
    expect(valueInExcerpt(one('v1/flag'), identifiers).verdict).toBe('pass');
    expect(
      valueInExcerpt(with_('v1/flag', { excerpt: 'flag of Panama' }), identifiers),
    ).toMatchObject({ verdict: 'fail', reason: 'value_not_in_excerpt' });
  });

  it('gives cannot_check for a coded value that no text quotes', () => {
    expect(valueInExcerpt(one('v1/kind'), identifiers)).toMatchObject({
      verdict: 'cannot_check',
      reason: 'coded_value',
    });
  });

  it('passes a claim when one citation of two holds the value', () => {
    const two: Claim = {
      ...one('v1/flag'),
      citations: [
        { ...one('v1/flag').citations[0], excerpt: 'page header' },
        ...one('v1/flag').citations,
      ],
    };
    expect(valueInExcerpt(two, identifiers).verdict).toBe('pass');
  });

  it('checks that a relation names its far end', () => {
    expect(valueInExcerpt(one('r-own'), identifiers).verdict).toBe('pass');
    expect(
      valueInExcerpt(with_('r-own', { excerpt: 'Blue Ltd owns ships' }), identifiers).verdict,
    ).toBe('cannot_check');
  });

  it('fails a citation of a leak host', () => {
    expect(denyList(one('v1/flag')).verdict).toBe('pass');
    expect(
      denyList(with_('v1/flag', { document_address: 'https://offshoreleaks.icij.org/nodes/1' }))
        .verdict,
    ).toBe('fail');
  });

  it('checks the IMO check digit', () => {
    expect(identifierValid(one('v1/imo')).verdict).toBe('pass');
    expect(identifierValid({ ...one('v1/imo'), value: '9435338' }).verdict).toBe('fail');
    expect(identifierValid(one('v1/flag')).verdict).toBe('not_applicable');
    expect(identifierValid({ ...one('v1/imo'), value: '[]' }).verdict).toBe('not_applicable');
    expect(identifierValid({ ...one('v1/imo'), value: '[1' }).reason).toBe('value_not_parsed');
  });

  it('checks the order of the dates, and the date of the act of a designation', () => {
    const acts = new Map([[ACT, new Set(['adopted_on'])]]);
    expect(dates(one('r-own'), acts).verdict).toBe('pass');
    expect(dates(with_('r-own', { valid_to: '2023-01-01' }), acts).verdict).toBe('fail');
    expect(dates(with_('r-own', { valid_from: '1 March 2024' }), acts).verdict).toBe('fail');
    expect(dates(with_('r-own', { valid_from: '2020-13-45' }), acts).verdict).toBe('fail');
    expect(dates(with_('r-own', { valid_from: '2023-02-30' }), acts).verdict).toBe('fail');
    expect(dates(one('r-des'), acts).verdict).toBe('pass');
    expect(dates(one('r-des'), new Map()).reason).toBe('no_act_date');
  });

  it('reads a bound that the release gives as a claim of the relation', () => {
    const days = new Map([
      ['r-des/valid_from', { day: '2025-01-10', official: true }],
      ['r-own/valid_to', { day: '2024-01-01', official: true }],
    ]);
    expect(dates(one('r-des'), new Map(), days).reason).toBe('the bounds are in order');
    expect(dates(one('r-own'), new Map(), days).reason).toBe(
      'start 2024-03-01 after end 2024-01-01',
    );
  });

  it('needs an official document and the own identifier of the subject for a designation', () => {
    expect(designationSource(one('r-des'), identifiers).verdict).toBe('pass');
    expect(
      designationSource(with_('r-des', { excerpt: 'OCEAN STAR, a tanker' }), identifiers).reason,
    ).toBe('name_only');
    expect(
      designationSource(with_('r-des', { document_type: 'news_article' }), identifiers).reason,
    ).toBe('no_official_document');
    expect(designationSource(one('r-own'), identifiers).verdict).toBe('not_applicable');
  });

  it('matches an identifier as a whole token only', () => {
    expect(holdsIdentifier('IMO9435337;', '9435337')).toBe(true);
    expect(holdsIdentifier('ref 194353371', '9435337')).toBe(false);
    expect(holdsIdentifier('LEI 2138ABCD', '2138AB')).toBe(false);
    expect(holdsIdentifier('943 5337', '9435337')).toBe(false);
    expect(holdsIdentifier('ships 12 9435337', '9435337')).toBe(true);
  });
});

describe('the checks of the stored document', () => {
  const bytes = new TextEncoder().encode('stored file');
  const reader = (
    over: Partial<{ sha: string; level: string; text: string }> = {},
  ): RecordReader => ({
    document: (id) =>
      Promise.resolve(
        id === 'doc_a'
          ? {
              sha256: over.sha ?? sha256Of(bytes),
              level: over.level ?? 'A',
              storedSha256: sha256Of(bytes),
            }
          : null,
      ),
    page: () => Promise.resolve(over.text ?? 'Text: flag of Gabon. End.'),
  });

  it('gives cannot_check(needs_record) in release mode', async () => {
    const results = await recordChecks(one('v1/flag'), null);
    expect(results.map((r) => r.reason)).toEqual(Array(4).fill('needs_record'));
  });

  it('passes a document that exists, has its hash, holds the excerpt at its page and has level A', async () => {
    const results = await recordChecks(one('v1/flag'), reader());
    expect(results.map((r) => r.verdict)).toEqual(['pass', 'pass', 'pass', 'pass']);
  });

  it('fails a changed file, an excerpt not at its page, a low level and an absent document', async () => {
    const results = await recordChecks(
      one('v1/flag'),
      reader({ sha: 'other', level: 'B', text: 'x' }),
    );
    expect(results.map((r) => r.verdict)).toEqual(['pass', 'fail', 'fail', 'fail']);
    const absent = await recordChecks(with_('v1/flag', { document_id: 'doc_z' }), reader());
    expect(absent[0]?.verdict).toBe('fail');
  });

  it('fails the hash of a document with no hash and no stored bytes', async () => {
    const empty: RecordReader = {
      document: () => Promise.resolve({ sha256: '', level: 'A', storedSha256: '' }),
      page: () => Promise.resolve(null),
    };
    const results = await recordChecks(one('v1/flag'), empty);
    expect(results[1]?.verdict).toBe('fail');
  });

  it('gives the hash cannot_check(needs_store) through the tunnel, and runs the three other checks', async () => {
    const tunnel: RecordReader = {
      document: () => Promise.resolve({ sha256: sha256Of(bytes), level: 'A', storedSha256: null }),
      page: () => Promise.resolve('Text: flag of Gabon. End.'),
    };
    const results = await recordChecks(one('v1/flag'), tunnel);
    expect(results.map((r) => `${r.verdict} ${r.reason}`)).toEqual([
      'pass each cited document is in the record',
      'cannot_check needs_store',
      'pass an excerpt is in the stored text at its page',
      'pass a cited document has level A',
    ]);
  });
});

describe('a document that the tunnel role may not read', () => {
  it('gives cannot_check(not_export_document), never an absent document or a fail', async () => {
    const hidden: RecordReader = {
      document: () => Promise.resolve('hidden'),
      page: () => Promise.resolve(null),
    };
    const results = await recordChecks(one('v1/flag'), hidden);
    expect(results.map((r) => `${r.check} ${r.verdict}`)).toEqual([
      'document_exists pass',
      'hash cannot_check',
      'excerpt_at_page cannot_check',
      'document_level cannot_check',
    ]);
  });

  it('fails a document with no hash also when no store is read', async () => {
    const empty: RecordReader = {
      document: () => Promise.resolve({ sha256: '', level: 'A', storedSha256: null }),
      page: () => Promise.resolve(null),
    };
    expect((await recordChecks(one('v1/flag'), empty))[1]?.verdict).toBe('fail');
  });
});

describe('the file of the tunnel', () => {
  const password = 'ab'.repeat(16);

  it('gives the address of gabriel_audit on the loopback port of the file', () => {
    expect(tunnelConnection(tunnelEnvText(password, 15432))).toBe(
      `postgresql://gabriel_audit:${password}@127.0.0.1:15432/gabriel`,
    );
  });

  it('stops on a file with no password, another host or another database', () => {
    const good = tunnelEnvText(password, 15432);
    for (const bad of [
      good.replace(/GABRIEL_AUDIT_PASSWORD=.*/u, ''),
      good.replace('GABRIEL_DB_HOST=127.0.0.1', 'GABRIEL_DB_HOST=10.0.0.1'),
      good.replace('GABRIEL_DATABASE=gabriel', 'GABRIEL_DATABASE=gabriel_test'),
    ])
      expect(() => tunnelConnection(bad)).toThrow(/tunnel file/u);
  });
});

describe('the checks of a node', () => {
  it('finds a shared identifier and a person with no designation', () => {
    const twin = claimsOf([
      ...ROWS,
      cite({ claim_id: 'v2/imo', subject_id: 'v2', attribute: 'imo', value: '9435337' }),
    ]);
    const duplicates = duplicatesOf(
      [...ENTITIES, { id: 'v2', type: 'vessel', label: 'OCEAN STAR 2' }],
      identifiersOf(twin.values()),
    );
    const type = new Map(ENTITIES.map((row) => [row['id'] ?? '', row['type'] ?? '']));
    const [facts, dup, person] = nodeChecks([VESSEL, 'p1'], 3, duplicates, type, new Set([VESSEL]));
    expect(facts?.verdict).toBe('pass');
    expect(dup?.verdict).toBe('fail');
    expect(person?.verdict).toBe('fail');
    expect(nodeChecks([OWNER], 1, new Map(), type, new Set())[2]?.verdict).toBe('not_applicable');
  });

  it('never passes a node with no claim', () => {
    const results = nodeChecks([OWNER], 0, new Map(), new Map(), new Set());
    expect(results[0]).toMatchObject({ verdict: 'cannot_check', reason: 'no_claim' });
    expect(nodeVerdict(results, 'record')).toBe('incomplete');
  });

  it('rolls up: a fail wins, then an open check; release mode never says pass', () => {
    const pass = { check: 'x', verdict: 'pass' as const, reason: '' };
    const open = { check: 'x', verdict: 'cannot_check' as const, reason: 'name_only' };
    const record = { check: 'hash', verdict: 'cannot_check' as const, reason: 'needs_record' };
    expect(nodeVerdict([pass, { ...pass, verdict: 'fail' }], 'release')).toBe('fail');
    expect(nodeVerdict([pass, open], 'release')).toBe('incomplete');
    expect(nodeVerdict([pass, record], 'release')).toBe('release_pass');
    expect(nodeVerdict([pass], 'record')).toBe('pass');
  });
});

describe('the audit of a release', () => {
  it('drops a cut last line of the result file, so a run can go on', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'node-audit-')), 'results.jsonl');
    writeFileSync(file, '{"kind":"header"}\n{"kind":"node"');
    repairTail(file);
    expect(readFileSync(file, 'utf8')).toBe('{"kind":"header"}\n');
  });

  it('reads the record ids of the report nodes, also of a group node', () => {
    const text = "{ record_entity_id: 'a' },{ record_entity_id: '' },{ record_entity_id: 'b;c' }";
    expect(reportEntityIds(text)).toEqual(['a', 'b', 'c']);
  });

  it('orders the report nodes first, and puts a vessel in the node of its owner', () => {
    const { nodes, missingReportEntities } = auditOrder(FILES, [OWNER, 'gone']);
    expect(nodes[0]).toMatchObject({ id: OWNER, group: 'report' });
    expect(nodes[0]?.members).toEqual([VESSEL, OWNER]);
    expect(missingReportEntities).toEqual(['gone']);
  });

  it('keeps for a local check only the nodes that cite a listed document', () => {
    const context = contextOf(FILES, null);
    const { nodes } = auditOrder(FILES, [OWNER]);
    expect(citingNodes(nodes, context, new Set(['doc_a'])).map((one) => one.id)).toEqual([OWNER]);
    expect(citingNodes(nodes, context, new Set(['doc_z']))).toEqual([]);
  });

  it('gives a day claim of a relation to both ends of the relation', () => {
    const day = cite({
      claim_id: 'r-des/valid_from',
      subject_kind: 'relation',
      subject_id: 'r-des',
      attribute: 'valid_from',
      value: '2025-01-10',
    });
    const context = contextOf({ ...FILES, claims: [...ROWS, day] }, null);
    for (const end of [VESSEL, ACT])
      expect(context.claimsOfEntity.get(end)?.map((one) => one.id)).toContain('r-des/valid_from');
    expect(context.days.get('r-des/valid_from')).toEqual({ day: '2025-01-10', official: true });
  });

  it('writes one line for each node, with each check of each fact, and a summary', async () => {
    const context = contextOf(FILES, null);
    const { nodes } = auditOrder(FILES, [OWNER]);
    const node = nodes[0];
    if (node === undefined) throw new Error('no node');
    const line = await auditNode(node, context);
    expect(line.facts.map((fact) => fact.claim)).toEqual([
      'r-des',
      'r-own',
      'v1/flag',
      'v1/imo',
      'v1/kind',
    ]);
    expect(line.facts.every((fact) => fact.results.length === 11)).toBe(true);
    expect(line.verdict).toBe('incomplete');
    const header = {
      kind: 'header' as const,
      version: 1,
      mode: 'release' as const,
      release: { tag: 't', sha256: 's' },
      checks: [],
    };
    const summary = summaryOf([header, line], 2);
    expect(summary).toContain('Nodes audited: 1 of 2. The run is not complete.');
    expect(summary).toContain('| incomplete | 1 |');
    expect(failedClaimsOf([header, line])).toEqual([]);
  });
});
