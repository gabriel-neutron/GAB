// The read service as a caller meets it. A schema cache that PostgREST took before a reset once
// answered 404 on every path, and four suites stayed green.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { fixtureSize } from '../../src/shared/committed-fixture/size.ts';
import { probe } from '../probe.ts';

import { askReadApi, type ReadApiAnswer } from './read-api.ts';

// The map read answers for EVERY entity, and no longer for the ones that carry a geometry. A
// count under the entity count here is the filter on the geometry, come back.
test('the read service counts one map row for each entity', async () => {
  const [entities, drawn] = await Promise.all([
    askReadApi('entity', { count: true }),
    askReadApi('full_map', { count: true }),
  ]);
  expect(entities.status).toBe(200);
  expect(entities.total).toBeGreaterThan(0);
  expect({ status: drawn.status, total: drawn.total }).toStrictEqual({
    status: 200,
    total: entities.total,
  });
});

test('the read service counts the acts the committed fixture leaves waiting', async () => {
  const answer = await askReadApi('proposal?status=eq.pending', { count: true });
  expect({ status: answer.status, total: answer.total }).toStrictEqual({
    status: 200,
    total: fixtureSize.pending,
  });
});

// PU1: a reader of the read API gets the disclaimer of the dataset with the data. The text is
// the exact text of the operator, so a copy of the data can carry it word for word.
const DISCLAIMER = [
  '**About this data.** A machine reads public documents and proposes each claim. Each claim ' +
    'cites the documents that state it, and each claim carries a label that tells who decided it.',
  '',
  '- **Proposed — not checked:** a candidate. No rule and no person checked it. It is not ' +
    'evidence.',
  '- **Accepted by rule … — no person read it:** the claim passed a named rule on its cited ' +
    'sources. No person read it. Nobody has measured the accuracy of the rules yet.',
  '- **Accepted by an AI reviewer — no person read it:** an AI checked the claim. No person read ' +
    'it.',
  '- **Validated manually by the operator:** the operator read the sources and accepted the claim.',
  '',
  'A claim tells what its sources say. A source can be wrong. GAB gives no personal data about a ' +
    'person beyond what a cited source already publishes. Each row carries its label: when you ' +
    'copy a row, copy its label with it.',
  '',
  'Report an error: `<link>`. Right of reply: `<link>`.',
].join('\n');

test('the read service gives the disclaimer of the dataset', async () => {
  const answer = await askReadApi('dataset');
  expect({ status: answer.status, rows: answer.rows }).toStrictEqual({
    status: 200,
    rows: [{ disclaimer: DISCLAIMER }],
  });
});

const labelled = z.array(
  z.strictObject({ origin_label: z.string(), attr_labels: z.record(z.string(), z.string()) }),
);

test('the read service gives each claim with its label', async () => {
  const [entities, relations, proposals] = await Promise.all([
    askReadApi('entity?select=origin_label,attr_labels&limit=1'),
    askReadApi('relation?select=origin_label,attr_labels&limit=1'),
    askReadApi('proposal?select=origin_label&status=eq.pending&limit=1'),
  ]);
  expect(labelled.parse(entities.rows)).toHaveLength(1);
  expect(labelled.parse(relations.rows)).toHaveLength(1);
  expect(proposals.rows).toStrictEqual([{ origin_label: 'Proposed — not checked' }]);
});

const names = z.array(z.object({ name: z.string() }));

// A departure: the views and the doors are read from the catalogue and never written by hand, so
// a view or a door created later is covered on the day it is created. A view that the read role
// holds no grant on is not public, and it is the next test.
const API_VIEWS = `
  SELECT c.relname AS name
    FROM pg_catalog.pg_class c
   WHERE c.relnamespace = 'api'::regnamespace AND c.relkind = 'v'
     AND pg_catalog.has_table_privilege('gabriel_read', c.oid, 'SELECT')
   ORDER BY 1`;

const VIEWS = await probe('superuser', async (ask) =>
  names.parse(await ask(API_VIEWS)).map((row) => row.name),
);

test('the catalogue gives the view tests a view to read', () => {
  expect(VIEWS).toContain('entity');
});

test('the read service refuses the job view, because a job is not public', async () => {
  const answer = await askReadApi('job');
  expect(answer.status).toBe(401);
});

// A cache taken before a reset answers 404, and one taken after a drop answers an empty list.
// Neither is a contract fault, and both empty every surface.
for (const view of VIEWS)
  test(`the ${view} view answers with rows, and not with an empty list`, async () => {
    const answer = await askReadApi(view);
    expect({ view, status: answer.status, empty: answer.rows.length === 0 }).toStrictEqual({
      view,
      status: 200,
      empty: false,
    });
  });

const BASE_TABLES = ['entities', 'relations', 'documents', 'proposals'] as const;

// External constraint: the hint of this refusal is a guess of PostgREST at a near name, and the
// guess changes with the names in the cache, so it is not compared.
for (const table of BASE_TABLES)
  test(`the base table ${table} is not a path of the read service`, async () => {
    const answer = await askReadApi(table);
    expect({ status: answer.status, failure: answer.failure }).toMatchObject({
      status: 404,
      failure: {
        code: 'PGRST205',
        message: `Could not find the table 'api.${table}' in the schema cache`,
      },
    });
  });

test('the read service refuses the public schema', async () => {
  const answer = await askReadApi('entity', { headers: { 'Accept-Profile': 'public' } });
  expect({ status: answer.status, failure: answer.failure }).toStrictEqual({
    status: 406,
    failure: {
      code: 'PGRST106',
      message: 'Invalid schema: public',
      hint: 'Only the following schemas are exposed: api',
    },
  });
});

const ABSENT = 'permission denied for view entity';
const NO_ROW = '00000000-0000-0000-0000-000000000000';

// Each body names a real column. PostgREST answers 204 to a PATCH with an empty body, without
// asking the database, so an empty body would pass this test for the wrong reason.
const WRITES = [
  { verb: 'POST', path: 'entity', body: { label: 'a test' } },
  { verb: 'PATCH', path: `entity?id=eq.${NO_ROW}`, body: { label: 'a test' } },
  { verb: 'PUT', path: `entity?id=eq.${NO_ROW}`, body: { id: NO_ROW, label: 'a test' } },
  { verb: 'DELETE', path: `entity?id=eq.${NO_ROW}`, body: null },
] as const;

for (const { verb, path, body } of WRITES)
  test(`a ${verb} on the entity view is refused`, async () => {
    const answer = await askReadApi(path, {
      method: verb,
      headers: { 'Content-Type': 'application/json' },
      ...(body === null ? {} : { body: JSON.stringify(body) }),
    });
    expect({ status: answer.status, failure: answer.failure }).toStrictEqual({
      status: 401,
      failure: { code: '42501', message: ABSENT, hint: null },
    });
  });

const signatures = z.array(z.object({ name: z.string(), parameters: z.array(z.string()) }));

// External constraint: PostgREST sorts the parameter names of the body, and the COLLATE gives the
// same order, so the refusal message can be written out.
const SIGNATURES = `
  SELECT p.proname AS name,
         array(SELECT a.name FROM unnest(p.proargnames, p.proargmodes) AS a(name, mode)
                WHERE a.name IS NOT NULL AND coalesce(a.mode, 'i') IN ('i', 'b', 'v')
                ORDER BY a.name COLLATE "C") AS parameters
    FROM pg_catalog.pg_proc p
   WHERE p.pronamespace IN ('public'::regnamespace, 'api'::regnamespace) AND p.prosecdef
      OR p.oid = 'api.neighbourhood'::regproc
   ORDER BY 1`;

const catalogue = await probe('superuser', async (ask) => signatures.parse(await ask(SIGNATURES)));
const [present] = catalogue.filter((door) => door.name === 'neighbourhood');
const DOORS = catalogue.filter((door) => door.name !== 'neighbourhood');

type Signature = z.infer<typeof signatures>[number];

// External constraint: PostgREST looks a function up by the names in the body, so an empty body
// finds no function that takes a parameter, and a door exposed in api would answer 404 as well.
const call = (door: Signature): Promise<ReadApiAnswer> =>
  askReadApi(`rpc/${door.name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(door.parameters.map((name) => [name, null]))),
  });

const absence = (door: Signature): string =>
  door.parameters.length === 0
    ? `Could not find the function api.${door.name} without parameters in the schema cache`
    : `Could not find the function api.${door.name}(${door.parameters.join(', ')}) in the schema cache`;

test('the catalogue gives the rpc tests a function that is present in api', () => {
  expect(present?.parameters).toStrictEqual(['depth', 'root']);
});

test('a present api function, called the way each door is called, is found', async () => {
  const answer = present === undefined ? null : await call(present);
  expect(answer?.status).toBe(200);
});

for (const door of DOORS)
  test(`the write door ${door.name} is not reachable at rpc`, async () => {
    const answer = await call(door);
    expect({ status: answer.status, failure: answer.failure }).toStrictEqual({
      status: 404,
      failure: { code: 'PGRST202', message: absence(door), hint: null },
    });
  });
