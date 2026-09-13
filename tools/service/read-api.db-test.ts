// The read service as a caller meets it. A schema cache that PostgREST took before a reset once
// answered 404 on every path, and four suites stayed green.

import { expect, test } from 'vitest';

import { fixtureSize } from '../../src/shared/committed-fixture/size.ts';

import { askReadApi } from './read-api.ts';

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

const VIEWS = [
  'document',
  'entity',
  'relation',
  'proposal',
  'entity_type',
  'value_support',
  'key_usage',
  'full_map',
] as const;

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

for (const table of BASE_TABLES)
  test(`the base table ${table} is not a path of the read service`, async () => {
    const answer = await askReadApi(table);
    expect({ status: answer.status, failure: answer.failure }).toStrictEqual({
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
    failure: { code: 'PGRST106', message: 'Invalid schema: public' },
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
      failure: { code: '42501', message: ABSENT },
    });
  });

const DOORS = ['put_document', 'propose_change', 'promote_proposal', 'reject_proposal'] as const;

for (const door of DOORS)
  test(`the write door ${door} is not reachable at rpc`, async () => {
    const answer = await askReadApi(`rpc/${door}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect({ status: answer.status, failure: answer.failure }).toStrictEqual({
      status: 404,
      failure: {
        code: 'PGRST202',
        message: `Could not find the function api.${door} without parameters in the schema cache`,
      },
    });
  });
