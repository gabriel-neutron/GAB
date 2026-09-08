// THE SHAPE IS THE WHOLE RULE ON THE FREE HALF OF THE MODEL. M11 stands: no key allowlist, and
// no rule on a value beyond its shape. `attribute_key` describes what a key means for a reader
// and permits nothing, so a key nobody described is written, and a value that disagrees with the
// description of its key is written too.
//
// THE ENVELOPE IS NOT OPEN, and the last three tests are what stops that reading. `attrs_valid`
// still demands {v, src}, a value that is never null, at least one source, and a key that is a
// lower snake case identifier. M7, M8 and M9 are untouched.
//
// Each gesture opens a transaction, makes its calls and rolls back. The proposals ledger is
// append-only and a trigger refuses a delete, so the rollback is the only way back. The probe
// logs in as the superuser and then takes the identity of gabriel_app, because `propose_change`
// stamps the author from session_user.

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

// ============================================================== a key nobody described ======

test('a key that no row of attribute_key describes is accepted', async () => {
  const held = await propose(`{"russian_designation":{"v":"v/ch 03333",${CITED}}}`);
  expect(made.parse(held)).toHaveLength(1);
});

test('an undescribed key takes a value of any kind', async () => {
  const held = await propose(
    `{"crew_aboard":{"v":41,${CITED}},
      "under_way":{"v":true,${CITED}},
      "port_calls":{"v":["Rotterdam","Hamburg"],${CITED}}}`,
  );
  expect(made.parse(held)).toHaveLength(1);
});

// ================================ a key that IS described is held to nothing either ==========
// `berth_count` is described `quantity` and `imo` carries the shape of an IMO number. A
// description is not a rule: M11 leaves the free half of the model with no rule beyond the
// shape, so both values below land exactly as they were written.

test('a value of another kind than its key is described with is accepted', async () => {
  expect(made.parse(await propose(`{"berth_count":{"v":"two",${CITED}}}`))).toHaveLength(1);
});

test('a value that breaks the shape its key is described with is accepted', async () => {
  expect(made.parse(await propose(`{"imo":{"v":"948213",${CITED}}}`))).toHaveLength(1);
});

// =========================================== the envelope, which no ruling has opened ========

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
