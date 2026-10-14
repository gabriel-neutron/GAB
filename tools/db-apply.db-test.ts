// An apply file runs in one transaction. A file that fails halfway leaves no object, and the roles
// that it set do not hold after the failure.

import { randomUUID } from 'node:crypto';

import { expect, test } from 'vitest';
import { z } from 'zod';

import { applyFile } from './db-apply.ts';
import { probe } from './probe.ts';

const exists = async (name: string): Promise<boolean> =>
  z
    .array(z.object({ found: z.string().nullable() }))
    .parse(
      await probe('superuser', (ask) =>
        ask('SELECT to_regprocedure($1)::text AS found', [`public.${name}()`]),
      ),
    )[0]?.found !== null;

const probeName = (): string => `apply_probe_${randomUUID().replaceAll('-', '')}`;

test('a file that fails after a statement leaves nothing of that statement', async () => {
  const name = probeName();
  await expect(
    applyFile(
      `CREATE FUNCTION public.${name}() RETURNS int LANGUAGE sql AS 'SELECT 1';\nSELECT 1/0;\n`,
      'gabriel_test',
    ),
  ).rejects.toThrow();
  expect(await exists(name)).toBe(false);
});

test('a file that sets a role and fails leaves nothing either', async () => {
  const name = probeName();
  await expect(
    applyFile(
      `SET ROLE gabriel_owner;\nCREATE FUNCTION public.${name}() RETURNS int LANGUAGE sql AS 'SELECT 1';\nRESET ROLE;\nSELECT 1/0;\n`,
      'gabriel_test',
    ),
  ).rejects.toThrow();
  expect(await exists(name)).toBe(false);
});

test('a file that succeeds is committed', async () => {
  const name = probeName();
  await applyFile(
    `CREATE FUNCTION public.${name}() RETURNS int LANGUAGE sql AS 'SELECT 1';\n`,
    'gabriel_test',
  );
  expect(await exists(name)).toBe(true);
  await applyFile(`DROP FUNCTION public.${name}();\n`, 'gabriel_test');
});
