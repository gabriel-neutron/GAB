// The three register lookups, offline: a web that answers from a table, a store in memory and a
// database that is a map of hashes. No test of a lookup reaches the network.

import { createHash } from 'node:crypto';

import { expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { memoryStore } from './fetch-fixture.ts';
import { callTool, type Session, type Tool, type ToolOutcome } from './tool.ts';
import { json, noSql, stubWeb, text, type Asked } from './web-stub.ts';

const refusalOf = (outcome: ToolOutcome): string => (outcome.ok ? '' : outcome.refusal);

const toolNamed = (name: string): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === name);
  if (found === undefined) throw new Error(`the catalogue holds no tool named ${name}`);
  return found;
};

// A database that knows a document by the hash of its bytes, as the real one does.
const database = (): Session & { readonly stored: unknown[][] } => {
  const known = new Map<string, string>();
  const stored: unknown[][] = [];
  return {
    stored,
    query: (statement, values) => {
      if (statement.includes('WHERE d.sha256')) {
        const id = known.get(String(values[0]));
        return Promise.resolve({
          rows:
            id === undefined
              ? []
              : [{ id, title: 'held', mime: 'application/json', retrieved_at: '2026-10-05' }],
        });
      }
      stored.push(values);
      const id = `doc_${String(values[3]).slice(0, 12)}`;
      known.set(String(values[3]), id);
      return Promise.resolve({ rows: [{ id, pages: 1 }] });
    },
  };
};

const LEI = '5493001KJTIIGC8Y1R12';
const PARENT = '549300ABCDEFGHIJKL12';
const GLEIF = 'https://api.gleif.org/api/v1';

const record = {
  data: {
    attributes: { lei: LEI, entity: { legalName: { name: 'Child Ltd' }, jurisdiction: 'GB' } },
    relationships: {
      'direct-parent': {
        links: { 'relationship-record': `${GLEIF}/lei-records/${LEI}/direct-parent-relationship` },
      },
      'ultimate-parent': {
        links: {
          'reporting-exception': `${GLEIF}/lei-records/${LEI}/ultimate-parent-reporting-exception`,
        },
      },
    },
  },
};

const gleifWeb = () =>
  stubWeb((asked: Asked) => {
    const path = asked.url.pathname;
    if (path === `/api/v1/lei-records/${LEI}`) return json(record);
    if (path.endsWith('direct-parent-relationship'))
      return json({ data: { attributes: { relationship: { endNode: { id: PARENT } } } } });
    if (path.endsWith('reporting-exception'))
      return json({ data: { attributes: { reason: 'NATURAL_PERSONS' } } });
    if (path === '/api/v1/lei-records')
      return json({
        data: [
          {
            attributes: {
              lei: LEI,
              entity: { legalName: { name: 'Child Ltd' }, jurisdiction: 'GB' },
            },
          },
        ],
      });
    return text('absent', 404);
  });

const setup = (web: ReturnType<typeof stubWeb>) => {
  const store = memoryStore();
  return {
    store,
    session: database(),
    reach: { store, web, now: () => new Date('2026-10-05T10:00:00Z') },
  };
};

test('gleif_lookup stores the record and each parent answer once, and gives the parent LEI', async () => {
  const { store, session, reach } = setup(gleifWeb());
  const first = await callTool(toolNamed('gleif_lookup'), session, { lei: LEI }, reach);
  expect(first).toMatchObject({
    ok: true,
    output: {
      record: {
        lei: LEI,
        legalName: 'Child Ltd',
        status: 'stored',
        parents: [
          { level: 'direct', kind: 'relationship', parentLei: PARENT, status: 'stored' },
          { level: 'ultimate', kind: 'exception', parentLei: null, status: 'stored' },
        ],
      },
      leads: [],
    },
  });
  expect(store.puts).toHaveLength(3);
  expect(session.stored.map((values) => values[8])).toStrictEqual(['api', 'api', 'api']);
  expect(session.stored[0]?.[2]).toBe(`${GLEIF}/lei-records/${LEI}`);

  const second = await callTool(toolNamed('gleif_lookup'), session, { lei: LEI }, reach);
  expect(second).toMatchObject({ ok: true, output: { record: { status: 'known' } } });
  expect(store.puts).toHaveLength(3);
});

test('a hash decides the identity of the stored answer', async () => {
  const { session, reach } = setup(gleifWeb());
  await callTool(toolNamed('gleif_lookup'), session, { lei: LEI }, reach);
  const sha = createHash('sha256').update(JSON.stringify(record)).digest('hex');
  expect(session.stored[0]?.[3]).toBe(sha);
});

test('gleif_lookup follows a link inside GLEIF only', async () => {
  const web = stubWeb((asked) =>
    asked.url.pathname.startsWith('/api/v1/lei-records/')
      ? json({
          data: {
            attributes: { lei: LEI, entity: { legalName: { name: 'Child Ltd' } } },
            relationships: {
              'direct-parent': { links: { 'relationship-record': 'https://evil.example/x' } },
            },
          },
        })
      : text('absent', 404),
  );
  const { session, reach } = setup(web);
  const outcome = await callTool(toolNamed('gleif_lookup'), session, { lei: LEI }, reach);
  expect(outcome).toMatchObject({ ok: true, output: { record: { parents: [] } } });
  expect(web.asked.map((asked) => asked.url.host)).toStrictEqual(['api.gleif.org']);
});

test('a name search in GLEIF is a lead and stores nothing', async () => {
  const { store, reach } = setup(gleifWeb());
  const outcome = await callTool(toolNamed('gleif_lookup'), noSql, { name: 'Child' }, reach);
  expect(outcome).toStrictEqual({
    ok: true,
    output: { record: null, leads: [{ lei: LEI, legalName: 'Child Ltd', jurisdiction: 'GB' }] },
  });
  expect(store.puts).toStrictEqual([]);
});

test('gleif_lookup refuses with a sentence that says what to correct', async () => {
  const { session, reach } = setup(gleifWeb());
  const tool = toolNamed('gleif_lookup');
  expect(refusalOf(await callTool(tool, session, { lei: 'ABC' }, reach))).toContain('lei');
  expect(refusalOf(await callTool(tool, session, {}, reach))).toContain('lei or a name');
  expect(await callTool(tool, session, { lei: '5493001KJTIIGC8Y1R99' }, reach)).toMatchObject({
    ok: false,
    refusal: 'GLEIF holds no record of 5493001KJTIIGC8Y1R99',
  });
  expect(await callTool(tool, noSql, { lei: LEI }, { now: () => new Date() })).toMatchObject({
    ok: false,
  });
});

const CH_KEY = 'secret-key-1';
const CH = {
  company_number: '00140141',
  company_name: 'Intershipping Ltd',
  company_status: 'active',
};

const chWeb = (settings: { companiesHouseKey?: string } = { companiesHouseKey: CH_KEY }) =>
  stubWeb((asked) => {
    const path = asked.url.pathname;
    if (path === '/company/00140141') return json(CH);
    if (path === '/company/00140141/officers') return json({ items: [] });
    if (path === '/company/00140141/persons-with-significant-control')
      return json({ items: [{ name: 'A Person' }] });
    if (path === '/search/companies')
      return json({ items: [{ company_number: '00140141', title: 'Intershipping Ltd' }] });
    return text('absent', 404);
  }, settings);

test('companies_house stores each part once, and a 404 part is none', async () => {
  const web = chWeb();
  const { store, session, reach } = setup(web);
  const outcome = await callTool(
    toolNamed('companies_house'),
    session,
    { companyNumber: '00140141' },
    reach,
  );
  expect(outcome).toMatchObject({
    ok: true,
    output: {
      record: {
        companyNumber: '00140141',
        name: 'Intershipping Ltd',
        companyStatus: 'active',
        documents: [
          { part: 'profile', status: 'stored' },
          { part: 'officers', status: 'stored' },
          { part: 'control', status: 'stored' },
          { part: 'charges', document: null, status: 'none' },
        ],
      },
      leads: [],
    },
  });
  expect(store.puts).toHaveLength(3);
});

test('the key goes in a header and never in a stored address', async () => {
  const web = chWeb();
  const { session, reach } = setup(web);
  await callTool(toolNamed('companies_house'), session, { companyNumber: '00140141' }, reach);
  const basic = `Basic ${Buffer.from(`${CH_KEY}:`).toString('base64')}`;
  for (const asked of web.asked) {
    expect(asked.headers['authorization']).toBe(basic);
    expect(asked.url.href).not.toContain(CH_KEY);
  }
  for (const values of session.stored) expect(JSON.stringify(values)).not.toContain(CH_KEY);
});

test('companies_house with no key refuses and names the setting, and asks nothing', async () => {
  const web = chWeb({});
  const outcome = await callTool(
    toolNamed('companies_house'),
    noSql,
    { companyNumber: '00140141' },
    { store: memoryStore(), web, now: () => new Date() },
  );
  expect(refusalOf(outcome)).toContain('COMPANIES_HOUSE_API_KEY');
  expect(web.asked).toStrictEqual([]);
});

test('a name search in Companies House is a lead and stores nothing', async () => {
  const { store, reach } = setup(chWeb());
  const outcome = await callTool(toolNamed('companies_house'), noSql, { name: 'Inter' }, reach);
  expect(outcome).toMatchObject({
    ok: true,
    output: { record: null, leads: [{ companyNumber: '00140141', title: 'Intershipping Ltd' }] },
  });
  expect(store.puts).toStrictEqual([]);
});

test('companies_house says when the company is absent', async () => {
  const { session, reach } = setup(chWeb());
  const outcome = await callTool(
    toolNamed('companies_house'),
    session,
    { companyNumber: '99999999' },
    reach,
  );
  expect(outcome).toStrictEqual({
    ok: false,
    refusal: 'Companies House holds no company 99999999',
  });
});

const QID_ANSWER = {
  results: {
    bindings: [
      {
        item: { value: 'http://www.wikidata.org/entity/Q42' },
        itemLabel: { value: 'Example Co' },
        lei: { value: LEI },
        imo: { value: '1234567' },
      },
      {
        item: { value: 'http://www.wikidata.org/entity/Q42' },
        itemLabel: { value: 'Example Co' },
        lei: { value: LEI },
        imo: { value: '7654321' },
      },
    ],
  },
};

const wikidataWeb = () => stubWeb(() => json(QID_ANSWER));

test('wikidata_ids reads one item by qid, stores the answer and merges the rows', async () => {
  const web = wikidataWeb();
  const { store, session, reach } = setup(web);
  const outcome = await callTool(toolNamed('wikidata_ids'), session, { qid: 'q42' }, reach);
  expect(outcome).toMatchObject({
    ok: true,
    output: {
      status: 'stored',
      items: [{ qid: 'Q42', label: 'Example Co', lei: [LEI], imo: ['1234567', '7654321'] }],
    },
  });
  expect(store.puts).toHaveLength(1);
  expect(web.asked[0]?.url.searchParams.get('query')).toContain('VALUES ?item { wd:Q42 }');
});

test('wikidata_ids by an identifier lists candidates, so it is a lead and stores nothing', async () => {
  const { store, reach } = setup(wikidataWeb());
  const outcome = await callTool(
    toolNamed('wikidata_ids'),
    noSql,
    { key: 'lei', value: LEI },
    reach,
  );
  expect(outcome).toMatchObject({ ok: true, output: { document: null, status: null } });
  expect(store.puts).toStrictEqual([]);
});

test('wikidata_ids refuses a value that could change the query', async () => {
  const web = wikidataWeb();
  const { reach } = setup(web);
  const outcome = await callTool(
    toolNamed('wikidata_ids'),
    noSql,
    { key: 'lei', value: '" } DROP' },
    reach,
  );
  expect(outcome).toMatchObject({ ok: false });
  expect(web.asked).toStrictEqual([]);
  expect(refusalOf(await callTool(toolNamed('wikidata_ids'), noSql, {}, reach))).toContain(
    'a key and a value, or a qid',
  );
});
