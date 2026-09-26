// Every database suite of this folder connects through the probe. The rows it writes must land in
// the test database, because the ledger keeps them for ever and the record is published.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe } from './probe.ts';

const reached = z.array(z.object({ name: z.string() })).length(1);

test('a probe of a test run reaches the test database', async () => {
  const found = await probe('superuser', async (ask) =>
    reached.parse(await ask('SELECT current_database() AS name')),
  );
  expect(found).toStrictEqual([{ name: 'gabriel_test' }]);
});
