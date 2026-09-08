// The vocabulary says what a key MEANS, and never which keys exist. A key nobody declared is
// written and never refused, because the free half of the model exists so that a person or an
// agent can say a thing the schema never anticipated, and a key that must reach a .sql file
// before the value can be written takes that away.
//
// THE DOOR IS OPEN AND THE ENVELOPE IS NOT. `attrs_valid` still demands {v, src}, a value that is
// never null and at least one source, so M7, M8 and M9 are untouched. The first three tests would
// pass just as well if every rule had been deleted, and the last five are what stops that reading.
//
// Each gesture opens a transaction, makes its calls and rolls back. The proposals ledger is
// append-only and a trigger refuses a delete, so the rollback is the only way back. The probe
// logs in as the superuser and then takes the identity of gabriel_app, because `propose_change`
// stamps the author from session_user and only the superuser may retire a word.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const DOCUMENT = 'manual';
const TYPE = 'vessel';
const CITED = `"src":["${DOCUMENT}"]`;

const made = z.array(z.object({ id: z.uuid() }));

const gesture = <T>(work: (ask: Ask) => Promise<T>) =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      return await work(ask);
    } finally {
      await ask('ROLLBACK');
    }
  });

const proposal = (attrs: string): string =>
  `SELECT public.propose_change('create_entity',
     '{"type":"${TYPE}","label":"A vocabulary test","attrs":${attrs}}'::jsonb,
     ARRAY['${DOCUMENT}']::text[]) AS id`;

const propose = (attrs: string): Promise<readonly unknown[]> =>
  gesture(async (ask) => {
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    return ask(proposal(attrs));
  });

// ================================================================ a key nobody declared =====

test('a key that no row of attribute_key describes is accepted', async () => {
  const held = await propose(`{"russian_designation":{"v":"v/ch 03333",${CITED}}}`);
  expect(made.parse(held)).toHaveLength(1);
});

test('an undeclared key takes a value of any kind, because nothing declares its kind', async () => {
  const held = await propose(
    `{"crew_aboard":{"v":41,${CITED}},
      "under_way":{"v":true,${CITED}},
      "port_calls":{"v":["Rotterdam","Hamburg"],${CITED}}}`,
  );
  expect(made.parse(held)).toHaveLength(1);
});

// A retired word describes nothing, so it holds nothing either. It leaves service by leaving the
// screen and releasing its stem, and never by refusing a write.
test('a key the vocabulary retired is accepted like any undeclared key', async () => {
  const held = await gesture(async (ask) => {
    await ask(`UPDATE public.attribute_key SET retired = true WHERE key = 'berth_count'`);
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    return ask(proposal(`{"berth_count":{"v":"two",${CITED}}}`));
  });
  expect(made.parse(held)).toHaveLength(1);
});

// ========================================== a key that IS declared keeps its declaration ====

test('a declared key still holds its value to the kind it declares', async () => {
  await expect(propose(`{"berth_count":{"v":"two",${CITED}}}`)).rejects.toMatchObject({
    code: '23514',
    message: "proposal refused: 'berth_count' is declared quantity and the value is a string",
  });
});

test('a declared key still holds its value to the format it declares', async () => {
  await expect(propose(`{"imo":{"v":"948213",${CITED}}}`)).rejects.toMatchObject({
    code: '23514',
    message: "proposal refused: 'imo' does not match the declared format '^[0-9]{7}$'",
  });
});

// ============================================= the envelope, which this change did not open ==

test('an undeclared key carries no null value, because a value always exists', async () => {
  await expect(propose(`{"russian_designation":{"v":null,${CITED}}}`)).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_payload_attrs',
  });
});

test('an undeclared key cites a source like every other key', async () => {
  await expect(
    propose(`{"russian_designation":{"v":"v/ch 03333","src":[]}}`),
  ).rejects.toMatchObject({ code: '23514', constraint: 'proposals_payload_attrs' });
});

test('an undeclared key is still an identifier, and never a sentence with spaces', async () => {
  await expect(
    propose(`{"Russian Designation":{"v":"v/ch 03333",${CITED}}}`),
  ).rejects.toMatchObject({ code: '23514', constraint: 'proposals_payload_attrs' });
});
