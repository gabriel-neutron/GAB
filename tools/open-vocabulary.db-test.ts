// Departure: M11 puts no allowlist on a key and no rule on a value beyond its shape. No table
// describes a key, so each key is free and a value of any kind is written.

// Departure: the envelope is not open. `attrs_valid` demands {v, src}, a value that is never
// null, one source or more, and a key in lower snake case. The last three tests hold that.

// External constraint: the ledger is append-only and a trigger refuses a delete, so each gesture
// rolls back. It takes the identity of gabriel_app, because the author comes from session_user.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack } from './probe.ts';

const DOCUMENT = 'manual';
const TYPE = 'vessel';
const CITED = `"src":["${DOCUMENT}"]`;

const made = z.array(z.object({ id: z.uuid() }));

const proposal = (attrs: string): string =>
  `SELECT public.propose_change('create_entity',
     '{"type":"${TYPE}","label":"A vocabulary test","attrs":${attrs}}'::jsonb,
     ARRAY['${DOCUMENT}']::text[]) AS id`;

const propose = (attrs: string): Promise<readonly unknown[]> =>
  rolledBack('app', (ask) => ask(proposal(attrs)));

test('a key that no list permits is accepted', async () => {
  const held = await propose(`{"russian_designation":{"v":"v/ch 03333",${CITED}}}`);
  expect(made.parse(held)).toHaveLength(1);
});

test('a free key takes a value of any kind', async () => {
  const held = await propose(
    `{"crew_aboard":{"v":41,${CITED}},
      "under_way":{"v":true,${CITED}},
      "port_calls":{"v":["Rotterdam","Hamburg"],${CITED}}}`,
  );
  expect(made.parse(held)).toHaveLength(1);
});

test('a free key carries no null value, because a value always exists', async () => {
  await expect(propose(`{"russian_designation":{"v":null,${CITED}}}`)).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_payload_attrs',
  });
});

test('a free key cites a source like every other key', async () => {
  await expect(
    propose(`{"russian_designation":{"v":"v/ch 03333","src":[]}}`),
  ).rejects.toMatchObject({ code: '23514', constraint: 'proposals_payload_attrs' });
});

test('a free key is still an identifier, and never a sentence with spaces', async () => {
  await expect(
    propose(`{"Russian Designation":{"v":"v/ch 03333",${CITED}}}`),
  ).rejects.toMatchObject({ code: '23514', constraint: 'proposals_payload_attrs' });
});
