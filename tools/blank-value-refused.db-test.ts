// U-CON-05. A bare string value of an attribute is never blank. A list keeps no minimum: it can
// state a known "none", a real fact, so an empty list still passes.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const made = z.array(z.object({ id: z.uuid() }));

const withAttrs = (attribute: string): string =>
  `{"type":"vessel","label":"A blank value test","attrs":{"last_port_call":${attribute}}}`;

const proposedBy = async (ask: Ask, payload: string): Promise<unknown> => {
  await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
  const held = await ask(
    `SELECT public.propose_change('create_entity', '${payload}'::jsonb,
       ARRAY['manual']::text[]) AS id`,
  );
  await ask('RESET SESSION AUTHORIZATION');
  return made.parse(held);
};

const proposed = (payload: string): Promise<unknown> =>
  probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      return await proposedBy(ask, payload);
    } finally {
      await ask('ROLLBACK');
    }
  });

test('an empty string value is refused', async () => {
  await expect(proposed(withAttrs(`{"v":"","src":["manual"]}`))).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_payload_attrs',
  });
});

test('a whitespace-only string value is refused', async () => {
  await expect(proposed(withAttrs(`{"v":"   ","src":["manual"]}`))).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_payload_attrs',
  });
});

test('an empty list value is written, because it can state a known "none"', async () => {
  await expect(proposed(withAttrs(`{"v":[],"src":["manual"]}`))).resolves.toHaveLength(1);
});
