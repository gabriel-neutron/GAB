// The product removed the confidence of a proposal and the rating of a document. A test that reads
// the catalogue fails on the day a column, a view column or a door parameter brings one back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe } from './probe.ts';

const names = z.array(z.object({ name: z.string() }));

const COLUMNS = `
  SELECT table_schema || '.' || table_name || '.' || column_name AS name
    FROM information_schema.columns
   WHERE table_schema IN ('public', 'api')
     AND (column_name ILIKE '%confidence%' OR column_name ILIKE '%admiralty%')`;

const PARAMETERS = `
  SELECT p.proname || '.' || a.name AS name
    FROM pg_catalog.pg_proc p, unnest(p.proargnames) AS a(name)
   WHERE p.pronamespace IN ('public'::regnamespace, 'api'::regnamespace)
     AND (a.name ILIKE '%confidence%' OR a.name ILIKE '%admiralty%')`;

const BODIES = `
  SELECT p.proname AS name
    FROM pg_catalog.pg_proc p
   WHERE p.pronamespace IN ('public'::regnamespace, 'api'::regnamespace)
     AND (p.prosrc ILIKE '%confidence%' OR p.prosrc ILIKE '%admiralty%')`;

test('no table and no view holds a confidence or a rating', async () => {
  const held = await probe('superuser', async (ask) => names.parse(await ask(COLUMNS)));
  expect(held).toStrictEqual([]);
});

test('no door takes a confidence or a rating, and no function reads one', async () => {
  const held = await probe('superuser', async (ask) => [
    ...names.parse(await ask(PARAMETERS)),
    ...names.parse(await ask(BODIES)),
  ]);
  expect(held).toStrictEqual([]);
});
