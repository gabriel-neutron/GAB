// Red team of the rating write path. No role writes a letter or a digit, no door has a parameter
// that carries one, and a machine door stamps the capture day itself. Each gesture runs inside a
// transaction that rolls back, and every fixture is invented.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack } from './probe.ts';

const MACHINES = ['app', 'agent', 'research'] as const;

const RATED = `INSERT INTO public.documents (id, kind, title, uri, retrieved_at, admiralty, admiralty_origin)
  VALUES ('doc_aaaa01', 'url', 'an invented page', 'https://example.org/a', current_date, 'A1', 'human')`;

for (const identity of MACHINES)
  test(`gabriel_${identity} cannot write a rated document by hand`, async () => {
    await expect(rolledBack(identity, (ask) => ask(RATED))).rejects.toMatchObject({
      code: '42501',
    });
  });

for (const identity of MACHINES)
  test(`gabriel_${identity} cannot raise the letter of a stored document`, async () => {
    await expect(
      rolledBack(identity, (ask) =>
        ask("UPDATE public.documents SET admiralty = 'A1', admiralty_origin = 'human'"),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

// The read role holds nothing on `public`, and the api view is a read.
test('the read role cannot write a letter through the document view', async () => {
  await expect(
    rolledBack('read', (ask) => ask("UPDATE api.document SET admiralty = 'A1'")),
  ).rejects.toMatchObject({ code: '42501' });
});

// L1: a role writes no letter, no digit, no state and no flag. A door that took one as a parameter
// would be the way in, so the names of the parameters of every door are read.
const FORBIDDEN =
  /admiralty|letter|digit|rating|score|grade|reliab|credib|party|sanction|flag|track|origin_group|independen/;

const parameters = z.array(z.object({ door: z.string(), names: z.array(z.string()) }));

test('no door of the record has a parameter that carries a letter, a digit or a flag', async () => {
  const found = await rolledBack('superuser', async (ask) =>
    parameters.parse(
      await ask(`SELECT p.proname AS door, coalesce(p.proargnames, '{}') AS names
                   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.prosecdef`),
    ),
  );
  expect(found.length, 'the doors are found').toBeGreaterThan(10);
  const bad = found.flatMap((door) =>
    door.names.filter((name) => FORBIDDEN.test(name)).map((name) => `${door.door}(${name})`),
  );
  expect(bad).toStrictEqual([]);
});

test('a document stored through the fetch door has no letter', async () => {
  const [row] = await rolledBack('research', async (ask) => {
    await ask(
      `SELECT public.put_fetched_document('url', 'an invented page', 'raw/' || repeat('1', 64),
         'https://example.org/b', repeat('1', 64), 'text/html', current_date, NULL)`,
    );
    return ask(
      `SELECT admiralty, admiralty_origin FROM public.documents WHERE sha256 = repeat('1', 64)`,
    );
  });
  expect(row).toStrictEqual({ admiralty: null, admiralty_origin: null });
});

test('a proposal cannot name a document as its target', async () => {
  await expect(
    rolledBack('agent', (ask) =>
      ask(
        `SELECT public.propose_change('update_attrs', '{"attrs":{"admiralty":{"v":"A1"}}}'::jsonb,
           ARRAY['manual'], 'document', gen_random_uuid())`,
      ),
    ),
  ).rejects.toMatchObject({ code: '23514' });
});

// L9: the capture day comes from the capture. The door of a machine takes the day as a parameter,
// so a worker that lied could place a page before every other page and make it the first of its
// group. The day of a fetch is the day of the call, within one day for the clock of the zone.
const FETCH = `SELECT public.put_fetched_document('url', 'an invented page', 'raw/' || repeat('2', 64),
  'https://example.org/c', repeat('2', 64), 'text/html', $1::date, NULL)`;

for (const identity of ['research', 'agent'] as const)
  test(`gabriel_${identity} cannot backdate a fetched page`, async () => {
    await expect(rolledBack(identity, (ask) => ask(FETCH, ['2001-01-01']))).rejects.toMatchObject({
      code: '22023',
    });
  });

for (const identity of ['research', 'agent'] as const)
  test(`gabriel_${identity} cannot post-date a fetched page`, async () => {
    await expect(rolledBack(identity, (ask) => ask(FETCH, ['2099-01-01']))).rejects.toMatchObject({
      code: '22023',
    });
  });

test('a page fetched today is stored with the day of today', async () => {
  const [row] = await rolledBack('research', async (ask) => {
    await ask(FETCH, [new Date().toISOString().slice(0, 10)]);
    return ask(`SELECT retrieved_at = current_date AS today FROM public.documents
                 WHERE sha256 = repeat('2', 64)`);
  });
  expect(row).toStrictEqual({ today: true });
});

// The text of a document is private. The read role holds no grant on it, and no api view has a
// column that carries it, so a sanctioned outlet is never shown in full by the public read.
test('the read role cannot read the text of a document', async () => {
  await expect(
    rolledBack('read', (ask) => ask('SELECT text FROM public.document_text')),
  ).rejects.toMatchObject({ code: '42501' });
});

const columns = z.array(z.object({ name: z.string() }));

test('no api view has a column that carries the text of a document', async () => {
  const found = await rolledBack('superuser', async (ask) =>
    columns.parse(
      await ask(`SELECT table_name || '.' || column_name AS name
                   FROM information_schema.columns
                  WHERE table_schema = 'api' AND column_name IN ('text', 'body', 'content', 'page')`),
    ),
  );
  expect(found.map((row) => row.name)).toStrictEqual([]);
});
