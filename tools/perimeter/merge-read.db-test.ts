// What the public read role sees of a merge: the act, and never its copy, which can hold a
// relation that names a hidden person; and no alias of a survivor that it cannot read.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack } from '../probe.ts';

const copies = z.array(z.object({ copy: z.boolean() }));

// The committed fixture holds one merge.
const MERGE_COPY = `SELECT prior_value IS NOT NULL AS copy FROM api.proposal
                     WHERE op = 'merge_entities' AND status = 'accepted'`;

test('a tool role reads the copy of a merge, and the public read role does not', async () => {
  const tool = copies.parse(await rolledBack('app', (ask) => ask(MERGE_COPY)));
  const reader = copies.parse(await rolledBack('read', (ask) => ask(MERGE_COPY)));
  expect(tool.length).toBeGreaterThan(0);
  expect(tool.every((row) => row.copy)).toBe(true);
  expect(reader).toHaveLength(tool.length);
  expect(reader.every((row) => !row.copy)).toBe(true);
});

test('the public read role gets no alias of a survivor that is a hidden person', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    const [made] = z.array(z.object({ person: z.uuid(), other: z.uuid() })).parse(
      await ask(
        `WITH p AS (SELECT target_id FROM public.sign_change('a test', 'create_entity',
                      '{"type":"person","label":"HIDDEN TEST PERSON","sources":["manual"]}'::jsonb,
                      ARRAY['manual'], NULL, NULL, '{}')),
              o AS (SELECT target_id FROM public.sign_change('a test', 'create_entity',
                      '{"type":"person","label":"HIDDEN TEST OTHER","sources":["manual"]}'::jsonb,
                      ARRAY['manual'], NULL, NULL, '{}'))
         SELECT (SELECT target_id FROM p) AS person, (SELECT target_id FROM o) AS other`,
      ),
    );
    if (made === undefined) throw new Error('the persons were not written');
    await ask(`SELECT * FROM public.merge_entities('a test', $1::uuid, $2::uuid)`, [
      made.person,
      made.other,
    ]);
    const ALIAS = 'SELECT count(*)::int AS n FROM api.entity_alias WHERE absorbed_id = $1';
    const tool = await ask(ALIAS, [made.other]);
    await ask('RESET SESSION AUTHORIZATION');
    await ask('SET LOCAL ROLE gabriel_read');
    return { tool, reader: await ask(ALIAS, [made.other]) };
  });
  expect(seen).toStrictEqual({ tool: [{ n: 1 }], reader: [{ n: 0 }] });
});
