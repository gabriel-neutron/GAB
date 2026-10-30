// The record holds the registration jurisdiction as its ISO 3166-1 code. The database writes a
// known spelling as its code on each write of an entity, and migrations 0079 (RU) and 0090 (CY)
// write again each value that the record held before. A signed act keeps the value that its writer gave. Each
// test rolls back.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { JURISDICTION_SPELLINGS } from '@gab/tools/stated-value';
import { rolledBack, type Ask } from './probe.ts';

const MIGRATION = join(import.meta.dirname, '..', 'db', 'migrations', '0079_jurisdiction_code.sql');

const made = z.array(z.object({ target_id: z.uuid(), proposal_id: z.uuid() }));

const as = async <T>(ask: Ask, role: string, work: () => Promise<T>): Promise<T> => {
  await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
  const done = await work();
  await ask('RESET SESSION AUTHORIZATION');
  return done;
};

const signed = async (
  ask: Ask,
  op: string,
  payload: object,
  target: string | null = null,
  src: readonly string[] = ['manual'],
) => {
  const [row] = made.parse(
    await as(ask, 'gabriel_app', () =>
      ask(
        `SELECT * FROM public.sign_change('a test', $1, $2::jsonb, $3::text[], $4, $5::uuid,
           '{}'::uuid[])`,
        [op, JSON.stringify(payload), src, target === null ? null : 'entity', target],
      ),
    ),
  );
  if (row === undefined) throw new Error('the act was not signed');
  return row;
};

const company = (ask: Ask, label: string, jurisdiction: unknown, type = 'company') =>
  signed(ask, 'create_entity', {
    type,
    label,
    sources: ['manual'],
    attrs: { registration_jurisdiction: { v: jurisdiction, src: ['manual'] } },
  });

const heldRow = z.array(
  z.object({
    value: z.unknown(),
    src: z.array(z.string()),
    act: z.uuid(),
    act_value: z.unknown(),
  }),
);

// The value that the row holds, its documents, the act that set it, and the value of that act.
const held = async (ask: Ask, entity: string) => {
  const [row] = heldRow.parse(
    await ask(
      `SELECT e.attrs->'registration_jurisdiction'->'v' AS value,
              ARRAY(SELECT jsonb_array_elements_text(e.attrs->'registration_jurisdiction'->'src'))
                AS src,
              public.value_act(e.id, 'registration_jurisdiction')::text AS act,
              coalesce(p.payload #> '{attrs,registration_jurisdiction,v}', 'null'::jsonb)
                AS act_value
         FROM public.entities e
         LEFT JOIN public.proposals p ON p.id = public.value_act(e.id, 'registration_jurisdiction')
        WHERE e.id = $1::uuid`,
      [entity],
    ),
  );
  if (row === undefined) throw new Error('the entity is not in the record');
  return row;
};

const counted = z.array(z.object({ n: z.coerce.number(), spelled: z.coerce.number() }));

const census = async (ask: Ask) => {
  const [row] = counted.parse(
    await ask(`SELECT count(*) AS n,
        count(*) FILTER (WHERE attrs->'registration_jurisdiction'->'v'
                               ?| ARRAY['Russia', 'Russian Federation']) AS spelled
      FROM public.entities WHERE type = 'company' AND attrs ? 'registration_jurisdiction'`),
  );
  if (row === undefined) throw new Error('no count came back');
  return row;
};

test('a new fact with "Russia" or "Russian Federation" is stored as RU, and a signed act keeps its value', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const russia = await company(ask, 'A company of the code test', 'Russia');
    const federation = await company(ask, 'A bank of the code test', 'Russian Federation', 'bank');
    return [await held(ask, russia.target_id), await held(ask, federation.target_id)];
  });
  expect(found).toMatchObject([
    { value: 'RU', src: ['manual'], act_value: 'Russia' },
    { value: 'RU', src: ['manual'], act_value: 'Russian Federation' },
  ]);
});

test('a jurisdiction with no known spelling keeps its form, and a list keeps each code once', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    const belarus = await company(ask, 'A Minsk company of the code test', 'Belarus');
    const two = await company(ask, 'A company with two seats', [
      'Russian Federation',
      'Belarus',
      'RU',
      'Russia',
    ]);
    return [await held(ask, belarus.target_id), await held(ask, two.target_id)];
  });
  expect(found.map(({ value }) => value)).toStrictEqual(['Belarus', ['RU', 'Belarus']]);
});

test('an update with "Russia" on a value RU keeps the value and adds its documents', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await ask(
      `SELECT public.put_document('doc_jurisdiction_two', 'file', 'A second register',
         'raw/jurisdiction-two.pdf', NULL, NULL, NULL, 'application/pdf', '2026-10-14'::date)`,
    );
    const { target_id } = await company(ask, 'A company of the code test', 'RU');
    const update = await signed(
      ask,
      'update_attrs',
      { attrs: { registration_jurisdiction: { v: 'Russia', src: ['doc_jurisdiction_two'] } } },
      target_id,
      ['doc_jurisdiction_two'],
    );
    return { row: await held(ask, target_id), update: update.proposal_id };
  });
  expect(found.row).toMatchObject({
    value: 'RU',
    src: ['manual', 'doc_jurisdiction_two'],
    act: found.update,
    act_value: 'Russia',
  });
});

test('the database codes each spelling of the tool check to the same code', async () => {
  const spellings = Object.entries(JURISDICTION_SPELLINGS).flatMap(([code, names]) =>
    names.flatMap((name) => [
      [name, code],
      [` ${name.toUpperCase()} `, code],
      [name.normalize('NFD'), code],
    ]),
  );
  const coded = await rolledBack('superuser', async (ask) =>
    z
      .array(z.object({ code: z.string().nullable() }))
      .parse(
        await ask(
          'SELECT public.jurisdiction_code(s) AS code FROM unnest($1::text[]) WITH ORDINALITY AS x(s, n) ORDER BY n',
          [spellings.map(([name]) => name)],
        ),
      ),
  );
  expect(coded.map(({ code }) => code)).toStrictEqual(spellings.map(([, code]) => code));
});

// Departure: the trigger writes the code at each write, so the state before 0079 is made with
// the trigger off, inside the transaction that rolls back.
test('migration 0079 writes RU for each Russian company, and keeps the count, the documents and the act', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await ask('ALTER TABLE public.entities DISABLE TRIGGER entities_coded_jurisdiction');
    const russia = await company(ask, 'A Russia company of the migration', 'Russia');
    const federation = await company(ask, 'A Federation company of the migration', [
      'Russian Federation',
    ]);
    const belarus = await company(ask, 'A Belarus company of the migration', 'Belarus');
    await ask('ALTER TABLE public.entities ENABLE ALWAYS TRIGGER entities_coded_jurisdiction');
    const before = {
      census: await census(ask),
      russia: await held(ask, russia.target_id),
      federation: await held(ask, federation.target_id),
    };
    await ask(await readFile(MIGRATION, 'utf8'));
    await ask('RESET ROLE');
    return {
      before,
      after: {
        census: await census(ask),
        russia: await held(ask, russia.target_id),
        federation: await held(ask, federation.target_id),
        belarus: await held(ask, belarus.target_id),
      },
    };
  });
  expect(found.before.census.spelled).toBeGreaterThanOrEqual(2);
  expect(found.after.census).toStrictEqual({ n: found.before.census.n, spelled: 0 });
  expect(found.after.russia).toStrictEqual({ ...found.before.russia, value: 'RU' });
  expect(found.after.federation).toStrictEqual({ ...found.before.federation, value: ['RU'] });
  expect(found.after.russia.act_value).toBe('Russia');
  expect(found.after.belarus.value).toBe('Belarus');
});

test('migration 0090 writes CY for each Cyprus company, and keeps the documents and the act', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await ask('ALTER TABLE public.entities DISABLE TRIGGER entities_coded_jurisdiction');
    const cyprus = await company(ask, 'A Cyprus company of the migration', 'Cyprus');
    const two = await company(ask, 'A Cyprus company with two values', ['Cyprus', 'CY', 'Russia']);
    await ask('ALTER TABLE public.entities ENABLE ALWAYS TRIGGER entities_coded_jurisdiction');
    const before = await held(ask, cyprus.target_id);
    await ask(
      await readFile(
        join(import.meta.dirname, '..', 'db', 'migrations', '0090_jurisdiction_cyprus.sql'),
        'utf8',
      ),
    );
    await ask('RESET ROLE');
    return {
      before,
      after: await held(ask, cyprus.target_id),
      two: await held(ask, two.target_id),
    };
  });
  expect(found.before.value).toBe('Cyprus');
  expect(found.two.value).toStrictEqual(['CY', 'RU']);
  expect(found.after).toStrictEqual({ ...found.before, value: 'CY' });
  expect(found.after.act_value).toBe('Cyprus');
});
