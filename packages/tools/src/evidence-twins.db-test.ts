// The check door holds a SQL copy of three rules that TypeScript also holds: the IMO checksum, the
// CAPTCHA words and the personal categories. Each test runs both copies on the same input and holds
// the two results equal, so the two copies cannot drift apart.

import { isValidImo } from '@gab/proposal/identifiers';
import { CAPTCHA } from './fetch-document.ts';
import { PERSONAL_KEYS } from './personal.ts';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe } from '../../../tools/probe.ts';

// Invented: each value is built from the rule, and none is the number of a real vessel.
const IMO_FIXTURES = [
  '9123453',
  '9876505',
  '9135793',
  '9123454',
  '9876500',
  '912345',
  '91234530',
  'IMO9123453',
  '912345a',
  '',
];

test('the IMO helper of the door and isValidImo give the same result on each fixture', async () => {
  const rows = await probe('superuser', async (ask) =>
    z
      .array(z.object({ value: z.string(), ok: z.boolean() }))
      .parse(
        await ask(
          'SELECT v AS value, public.ev_imo_valid(v) AS ok FROM unnest($1::text[]) WITH ORDINALITY AS t(v, n) ORDER BY n',
          [IMO_FIXTURES],
        ),
      ),
  );
  expect(rows.map((row) => row.ok)).toStrictEqual(IMO_FIXTURES.map(isValidImo));
  expect(rows.filter((row) => row.ok).map((row) => row.value)).toStrictEqual([
    '9123453',
    '9876505',
    '9135793',
  ]);
});

test('the CAPTCHA words of the door are the words of the fetch tool', async () => {
  const [row] = await probe('superuser', async (ask) =>
    z
      .array(z.object({ pattern: z.string() }))
      .parse(await ask('SELECT public.ev_captcha_pattern() AS pattern')),
  );
  expect(row?.pattern).toBe(CAPTCHA.source);
  expect(CAPTCHA.flags).toContain('i');
});

test('the CHECK on the personal categories of a model call holds the words of PERSONAL_KEYS', async () => {
  const [row] = await probe('superuser', async (ask) =>
    z.array(z.object({ definition: z.string() })).parse(
      await ask(
        `SELECT pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c
          WHERE c.conname = 'model_call_personal_categories_word'`,
      ),
    ),
  );
  const words = [...(row?.definition ?? '').matchAll(/'([a-z_]+)'/gu)].map((match) => match[1]);
  expect(words).toStrictEqual([...PERSONAL_KEYS]);
});
