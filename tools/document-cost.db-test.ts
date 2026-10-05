// A bought filing records what it cost, in euros, and the unit is in the name of the column. The
// read surface publishes the cost and the list of providers. Each gesture rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, rolledBack, type Ask } from './probe.ts';

const PUT_PRICED = `SELECT public.put_document($1, 'url', 'A cost test', NULL,
  'https://example.org/' || $1, NULL, NULL, NULL, NULL, 'mca21', $2::numeric) AS id`;

const costs = z.array(z.object({ cost_eur: z.string().nullable() }));

const asOwner = async (ask: Ask): Promise<void> => {
  await ask('SET LOCAL ROLE gabriel_owner');
};

test('put_document stores the cost it gets, and the read view publishes it', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await asOwner(ask);
    await ask(PUT_PRICED, ['doc_c0517e5700aa', '125.50']);
    await ask('RESET ROLE');
    return costs.parse(
      await ask('SELECT cost_eur FROM api.document WHERE id = $1', ['doc_c0517e5700aa']),
    );
  });
  expect(found).toStrictEqual([{ cost_eur: '125.50' }]);
});

test('a negative cost is refused', async () => {
  await expect(
    rolledBack('superuser', async (ask) => {
      await asOwner(ask);
      await ask(PUT_PRICED, ['doc_c0517e5700ab', '-1']);
    }),
  ).rejects.toMatchObject({ code: '23514' });
});

const providers = z.array(z.object({ id: z.string(), name: z.string(), licence: z.string() }));

test('the read role reads the providers, their names and their licences', async () => {
  const found = await probe('read', async (ask) =>
    providers.parse(
      await ask("SELECT id, name, licence FROM api.document_provider WHERE id = 'mca21'"),
    ),
  );
  expect(found.map((row) => [row.id, row.licence, row.name !== ''])).toStrictEqual([
    ['mca21', 'paid-filing', true],
  ]);
});
