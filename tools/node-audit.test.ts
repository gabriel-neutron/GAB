import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  claimsOf,
  dates,
  denyList,
  farEndsOf,
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
  reportCountryGaps,
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

  // A1, real cases of the review of 2026-11-28 (valid_from and valid_to in OFAC, EU and RBI texts).
  it.each([
    ['Release Date: 02/24/2022', '2022-02-24'],
    ['Sberbank India | 13.8.2026', '2026-08-13'],
    ['through 12:01 a.m. eastern standard time, December 18, 2026', '2026-12-18'],
    ['on 24 February 2022', '2022-02-24'],
    ['24.02.2022', '2022-02-24'],
    ['за год, закончившийся 31 декабря 2025 года', '2025-12-31'],
  ])('finds the day in the written form of %s', (excerpt, value) => {
    const claim = { ...with_('v1/flag', { excerpt }), attribute: 'valid_from', value };
    expect(valueInExcerpt(claim, identifiers).verdict).toBe('pass');
  });

  it('gives an ambiguous order of day and month cannot_check, and fails another day', () => {
    const check = (excerpt: string, value: string) =>
      valueInExcerpt(
        { ...with_('v1/flag', { excerpt }), attribute: 'valid_from', value },
        identifiers,
      );
    // Real case: the UK list writes 09/04/2025, and the order of day and month is a guess.
    const uk = '09/04/2025,RUS1072,15015,,Gazprombank';
    expect(check(uk, '2025-04-09')).toMatchObject({
      verdict: 'cannot_check',
      reason: 'ambiguous_date',
    });
    // Real case: the claim gives 2022-03-24, and the excerpt gives no such day in each order.
    expect(check(uk, '2022-03-24').verdict).toBe('fail');
    expect(check('on 25 February 2022', '2022-02-24').verdict).toBe('fail');
    expect(check('Release Date: 02/25/2022', '2022-02-24').verdict).toBe('fail');
  });

  // A4, real cases: Ust-Luga cargo, Primorsk loadings, Transneft exports, two addresses in Russia.
  it.each([
    [
      'cargo_turnover_mt_2021',
      '109.2',
      'Грузооборот портов Усть-Луга составил 109,2 млн т (+6,5%)',
    ],
    [
      'planned_loadings_2025_09_bpd',
      '900000',
      'loadings at Primorsk, which had been expected to handle 900,000 bpd in September',
    ],
    [
      'oil_export_shipments_change_2025_vs_2024_pct',
      '1.1',
      'выросли на 1,1% по сравнению с 2024 годом',
    ],
    [
      'registration_jurisdiction',
      'RU',
      '34737,52046,"46 Prospekt Tekstilshchikov","Kostroma 156000","Russia"',
    ],
    [
      'registration_jurisdiction',
      'RU',
      'Place of registration: St. Petersburg, Russian Federation',
    ],
  ])('finds the %s value %s in its written form', (attribute, value, excerpt) => {
    const claim = { ...with_('v1/flag', { excerpt }), attribute, value };
    expect(valueInExcerpt(claim, identifiers).verdict).toBe('pass');
  });

  it('fails a different number, scale or country, and leaves an unstated scale open', () => {
    const check = (attribute: string, value: string, excerpt: string) =>
      valueInExcerpt({ ...with_('v1/flag', { excerpt }), attribute, value }, identifiers);
    const ustLuga = 'Грузооборот портов Усть-Луга составил 109,2 млн т (+6,5%)';
    expect(check('cargo_turnover_mt_2021', '109.3', ustLuga).verdict).toBe('fail');
    expect(check('cargo_turnover_mt_2021', '109.2', 'составил 109,2 тыс т').verdict).toBe('fail');
    expect(check('planned_loadings_2025_09_bpd', '950000', 'handle 900,000 bpd').verdict).toBe(
      'fail',
    );
    // "900,000" can be 900 with a decimal comma: never a pass on that reading.
    expect(check('planned_loadings_2025_09_bpd', '900', 'handle 900,000 bpd')).toMatchObject({
      verdict: 'cannot_check',
      reason: 'ambiguous_number',
    });
    expect(check('cargo_turnover_mt_2021', '1100', 'составил 1,100 млн т')).toMatchObject({
      verdict: 'cannot_check',
      reason: 'ambiguous_number',
    });
    expect(check('planned_loadings_2025_09_bpd', '5108691', 'total 5,108,691 bpd').verdict).toBe(
      'pass',
    );
    // Real case: the table of Belarusbank is in thousands, and the excerpt does not say so.
    const table = 'Итого по МСФО 5 108 691 5 093 054 4 478 517';
    expect(check('total_assets_bn_byn', '5.108691', table)).toMatchObject({
      verdict: 'cannot_check',
      reason: 'scale_not_stated',
    });
    expect(check('total_assets_bn_byn', '5.108692', table).verdict).toBe('fail');
    // Real case: the excerpt gives a name and no country.
    const kupol = '46431,"JOINT STOCK COMPANY IZHEVSK ELECTROMECHANICAL PLANT KUPOL"';
    expect(check('registration_jurisdiction', 'RU', kupol).verdict).toBe('fail');
    expect(check('registration_jurisdiction', 'RU', 'flag of Belarus').verdict).toBe('fail');
    // A country name that is a place inside another name, or a word of another sense, is no value.
    expect(check('registration_jurisdiction', 'GN', 'Registered in Papua New Guinea').verdict).toBe(
      'fail',
    );
    expect(check('registration_jurisdiction', 'JE', 'an office in New Jersey').verdict).toBe(
      'fail',
    );
    expect(
      check('registration_jurisdiction', 'RU', 'a company owned by a Russian businessman').verdict,
    ).toBe('fail');
    expect(check('registration_jurisdiction', 'RU', '46431,ROSNEFT,Russia,Moscow').verdict).toBe(
      'pass',
    );
    expect(check('flag', 'PA', 'Flag: Panama').verdict).toBe('pass');
  });

  // A3, real cases: VTB Bank in the OFAC SDN.CSV, Transneft in Russian, General License No. 8L.
  it('names the far end by another legal form, a stored name, or the cited act itself', () => {
    const entities = [
      { id: 'vtb', type: 'company', label: 'PJSC VTB Bank', document_ids: '' },
      { id: 'tn', type: 'company', label: 'Transneft', document_ids: '' },
      {
        id: 'gl8l',
        type: 'legal_act',
        label: 'General License No. 8L',
        document_ids: 'doc_ec913f5e9458',
      },
    ];
    const names = [
      cite({
        claim_id: 'tn/name_cyrillic',
        subject_id: 'tn',
        attribute: 'name_cyrillic',
        value: 'Транснефть',
        excerpt: 'x',
      }),
    ];
    const ends = farEndsOf(entities, claimsOf(names).values());
    const check = (relationType: string, object: string, objectLabel: string, over: Row) =>
      valueInExcerpt(
        { ...with_('r-own', over), relationType, object, objectLabel },
        identifiers,
        ends,
      ).verdict;
    const vtb = (excerpt: string) => check('associated_with', 'vtb', 'PJSC VTB Bank', { excerpt });
    expect(vtb('17013,"VTB BANK PUBLIC JOINT STOCK COMPANY"')).toBe('pass');
    expect(
      check('owns', 'tn', 'Transneft', {
        excerpt: 'контролирующим акционером НМТП является компания ПАО «Транснефть»',
      }),
    ).toBe('pass');
    const act = {
      excerpt: '(5) VTB Bank Public Joint Stock Company;',
      document_id: 'doc_ec913f5e9458',
      document_type: 'register_entry',
    };
    const gl = (over: Row) =>
      check('exempted_by', 'gl8l', 'General License No. 8L', { ...act, ...over });
    expect(gl({})).toBe('pass');
    // A place in brackets or a kind word is a part of the name: another entity is not named.
    const belarus = (excerpt: string) => check('owns', 'vtb-by', 'VTB Bank (Belarus)', { excerpt });
    expect(belarus('17013,"VTB BANK PUBLIC JOINT STOCK COMPANY"')).toBe('cannot_check');
    expect(belarus('a bank in Belarus')).toBe('cannot_check');
    expect(
      check('products_flow_to', 'tuapse', 'Tuapse Refinery', {
        excerpt: 'The fire at the port of Tuapse was put out',
      }),
    ).toBe('cannot_check');
    // Still not named: another bank, a document that is not the act, a news article.
    expect(vtb('17014,"SBERBANK PUBLIC JOINT STOCK COMPANY"')).toBe('cannot_check');
    expect(gl({ document_id: 'doc_other' })).toBe('cannot_check');
    expect(gl({ document_type: 'news_article' })).toBe('cannot_check');
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

  it('passes a document that exists, has its hash, holds the excerpt at its page and has a level', async () => {
    const results = await recordChecks(one('v1/flag'), reader());
    expect(results.map((r) => r.verdict)).toEqual(['pass', 'pass', 'pass', 'pass']);
  });

  it('fails a changed file, an excerpt not at its page, a document with no level and an absent document', async () => {
    const results = await recordChecks(
      one('v1/flag'),
      reader({ sha: 'other', level: '', text: 'x' }),
    );
    expect(results.map((r) => r.verdict)).toEqual(['pass', 'fail', 'fail', 'fail']);
    expect(results[3]?.reason).toBe('no_level_in_record');
    const absent = await recordChecks(with_('v1/flag', { document_id: 'doc_z' }), reader());
    expect(absent[0]?.verdict).toBe('fail');
  });

  // A5, ADR 0039: the level is a mark. A GUR page at not_verified is no fault of the fact.
  it('passes a fact that cites only an unrated document as unrated, and fails an unknown level', async () => {
    expect((await recordChecks(one('v1/flag'), reader({ level: 'not_verified' })))[3]).toEqual({
      check: 'document_level',
      verdict: 'pass',
      reason: 'unrated',
    });
    expect((await recordChecks(one('v1/flag'), reader({ level: 'X' })))[3]).toMatchObject({
      verdict: 'fail',
      reason: 'no_level_in_record',
    });
    // An unknown level beside an unrated document is still a fault.
    const mixed: RecordReader = {
      document: (id) =>
        Promise.resolve({
          sha256: sha256Of(bytes),
          level: id === 'doc_a' ? 'not_verified' : '',
          storedSha256: sha256Of(bytes),
        }),
      page: () => Promise.resolve('Text: flag of Gabon. End.'),
    };
    const two: Claim = {
      ...one('v1/flag'),
      citations: [
        ...one('v1/flag').citations,
        { ...one('v1/flag').citations[0], document_id: 'doc_b' },
      ],
    };
    expect((await recordChecks(two, mixed))[3]).toMatchObject({
      verdict: 'fail',
      reason: 'no_level_in_record',
    });
  });

  // A2, real case: the stored text of the OFAC SDN.CSV has no quotes, the excerpt keeps them.
  it('finds a quoted CSV excerpt in a stored text with no quotes, and fails another field', async () => {
    const stored =
      '51632,LIBERTY,vessel,UKRAINE-EO13662] [RUSSIA-EO14024,-0- ,8P2253,Crude Oil Tanker,-0- ,-0- ,Barbados';
    const row = (excerpt: string) => with_('v1/flag', { excerpt });
    const quoted = '51632,"LIBERTY","vessel","UKRAINE-EO13662] [RUSSIA-EO14024",-0- ,"8P2253"';
    expect((await recordChecks(row(quoted), reader({ text: stored })))[2]?.verdict).toBe('pass');
    const other = '51632,"LIBERTY","vessel","UKRAINE-EO13662] [RUSSIA-EO14024",-0- ,"8P2257"';
    expect((await recordChecks(row(other), reader({ text: stored })))[2]?.reason).toBe(
      'excerpt_not_at_page',
    );
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
      'pass a cited document has a level',
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
    const text = "{ record_entity_id: 'a' },{ record_entity_id: '' },{ record_entity_id:\n 'b;c' }";
    expect(reportEntityIds(text)).toEqual(['a', 'b', 'c']);
  });

  it('names a report node with no country when the release gives the country of its entity', () => {
    const text = [
      "{ node_id: 'N-1', country_code: 'XX', record_entity_id: 'a' }",
      "{ node_id: 'N-2', country_code: 'RU', record_entity_id: 'b' }",
      "{ node_id: 'N-3', country_code: 'XX', record_entity_id: 'c;d' }",
      "{ node_id: 'N-4', country_code: 'XX', record_entity_id: '' }",
      // Prettier puts a long value on the next line.
      "{ node_id: 'N-5', country_code: 'XX', record_entity_id:\n      'e' }",
    ].join(',');
    const claim = (subject: string, attribute: string, value: string) => ({
      subject_kind: 'entity',
      subject_id: subject,
      attribute,
      value,
    });
    const claims = [
      claim('a', 'registration_jurisdiction', 'RU'),
      claim('b', 'registration_jurisdiction', 'RU'),
      claim('d', 'country', 'Russia'),
      claim('c', 'imo', '9327413'),
      claim('e', 'registration_jurisdiction', 'BY'),
    ];
    expect(reportCountryGaps(text, claims)).toEqual(['N-1 RU', 'N-3 RU', 'N-5 BY']);
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
    const claimed = context.claims.get('r-des/valid_from');
    if (claimed === undefined) throw new Error('no day claim');
    expect(dates(claimed, new Map()).verdict).toBe('pass');
    expect(dates({ ...claimed, value: '2025' }, new Map()).reason).toBe(
      'claimed_bound_not_a_day: 2025',
    );
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
