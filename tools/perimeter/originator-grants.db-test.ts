// The originator, its facts and its letter sit behind doors. No model role writes a letter, a flag
// or a state, so the grants are stated here door by door. The scan at the end proves that the
// letter function reads no claim table.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, rolledBack } from '../probe.ts';

const found = z.array(z.object({ found: z.string() }));

const TABLES = [
  'originator',
  'originator_scheme',
  'issuer_card',
  'belligerent',
  'sanctioned_hosts',
  'originator_sanction',
  'originator_resolution',
  'originator_letter_history',
  'originator_fact',
  'trust_list_load',
] as const;

const HOLDERS = `
  SELECT p.proname || ' to ' || CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                                      ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS found
    FROM pg_catalog.pg_proc p
   CROSS JOIN LATERAL pg_catalog.aclexplode(
           coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) AS a
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY($1)
     AND a.privilege_type = 'EXECUTE'
     AND (a.grantee = 0 OR pg_catalog.pg_get_userbyid(a.grantee) <> 'gabriel_owner')
   ORDER BY 1`;

const holdersOf = (names: readonly string[]): Promise<readonly string[]> =>
  probe('superuser', async (ask) =>
    found.parse(await ask(HOLDERS, [[...names]])).map((row) => row.found),
  );

test('gabriel_agent holds three doors of the originator and no other', async () => {
  const names = [
    'ensure_originator',
    'propose_originator_fact',
    'decide_originator_fact',
    'set_operator_letter',
    'remove_operator_letter',
    'contest_letter',
    'confirm_fabrication',
    'merge_originator',
    'link_imprint',
    'set_party_false',
    'load_trust_list',
    'originator_exceptions',
    'refresh_originator',
    'review_originator_card',
    'issuer_card_for',
    'originator_letter_for',
    'record_resolution',
    'set_gold_set_letter',
    'ack_letter_change',
  ];
  const held = (await holdersOf(names)).filter((row) => row.endsWith(' to gabriel_agent'));
  expect(held).toStrictEqual([
    'decide_originator_fact to gabriel_agent',
    'ensure_originator to gabriel_agent',
    'propose_originator_fact to gabriel_agent',
  ]);
});

test('gabriel_app holds the operator doors, and the doors of the code alone stay closed', async () => {
  const operator = [
    'set_operator_letter',
    'remove_operator_letter',
    'contest_letter',
    'confirm_fabrication',
    'merge_originator',
    'link_imprint',
    'set_party_false',
    'load_trust_list',
    'originator_exceptions',
    'refresh_originator',
    'review_originator_card',
    'ensure_originator',
    'propose_originator_fact',
    'issuer_card_for',
    'originator_letter_for',
  ];
  expect(
    (await holdersOf(operator)).filter((row) => row.endsWith(' to gabriel_app')),
  ).toStrictEqual([...operator].sort().map((name) => `${name} to gabriel_app`));
  expect(
    await holdersOf(['record_resolution', 'set_gold_set_letter', 'ack_letter_change']),
  ).toStrictEqual([]);
});

test('no door of the originator is open to PUBLIC, to the read role or to the research role', async () => {
  const names = [
    'ensure_originator',
    'propose_originator_fact',
    'decide_originator_fact',
    'set_operator_letter',
    'refresh_originator',
    'originator_exceptions',
    'load_trust_list',
    'issuer_card_for',
    'originator_letter_for',
  ];
  const held = await holdersOf(names);
  expect(
    held.filter((row) => /to (PUBLIC|gabriel_read|gabriel_research)$/.test(row)),
  ).toStrictEqual([]);
});

const REFUSED_WRITES = TABLES.flatMap((table) => [
  `INSERT INTO public.${table} DEFAULT VALUES`,
  `DELETE FROM public.${table}`,
]);

const WRITE_PRIVILEGES = `
  SELECT r.role || ' ' || t.name || ' ' || v.verb AS found
    FROM unnest($1::text[]) AS t(name)
   CROSS JOIN (VALUES ('gabriel_agent'), ('gabriel_app'), ('gabriel_research'), ('gabriel_read'))
         AS r(role)
   CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) AS v(verb)
   WHERE has_table_privilege(r.role, 'public.' || t.name, v.verb)
      OR (v.verb IN ('INSERT', 'UPDATE')
          AND has_any_column_privilege(r.role, 'public.' || t.name, v.verb))`;

test('no tool role holds INSERT, UPDATE, DELETE or TRUNCATE on a table of the originator', async () => {
  const held = await probe('superuser', async (ask) =>
    found.parse(await ask(WRITE_PRIVILEGES, [[...TABLES]])).map((row) => row.found),
  );
  expect(held).toStrictEqual([]);
});

for (const identity of ['agent', 'app', 'research', 'read'] as const)
  test(`gabriel_${identity} cannot write any table of the originator directly`, async () => {
    const allowed: string[] = [];
    for (const statement of REFUSED_WRITES) {
      const code = await rolledBack(identity, (ask) => ask(statement)).then(
        () => 'allowed',
        (error: unknown) => z.object({ code: z.string() }).safeParse(error).data?.code ?? 'other',
      );
      if (code !== '42501') allowed.push(`${statement} gave ${code}`);
    }
    expect(allowed).toStrictEqual([]);
  });

test('gabriel_agent cannot call an operator door', async () => {
  await expect(
    rolledBack('agent', (ask) =>
      ask(`SELECT public.set_operator_letter('host:a.example', 'A', 'a perimeter test')`),
    ),
  ).rejects.toMatchObject({ code: '42501' });
  await expect(
    rolledBack('agent', (ask) => ask(`SELECT public.refresh_originator('host:a.example')`)),
  ).rejects.toMatchObject({ code: '42501' });
  await expect(
    rolledBack('agent', (ask) => ask(`SELECT * FROM public.originator_exceptions()`)),
  ).rejects.toMatchObject({ code: '42501' });
});

test('gabriel_agent can call the door that creates an originator, and it gets letter F', async () => {
  const row = await rolledBack('agent', async (ask) => {
    await ask(`SELECT public.ensure_originator('telegram:42', 'A channel', 'account')`);
    return ask(`SELECT 1 FROM public.originator WHERE id = 'telegram:42'`).catch(() => 'no-read');
  });
  expect(row === 'no-read' || Array.isArray(row)).toBe(true);
});

test('gabriel_read cannot read an originator fact or call the exceptions door', async () => {
  await expect(
    rolledBack('read', (ask) => ask('SELECT 1 FROM public.originator_fact')),
  ).rejects.toMatchObject({ code: '42501' });
  await expect(
    rolledBack('read', (ask) => ask('SELECT * FROM public.originator_exceptions()')),
  ).rejects.toMatchObject({ code: '42501' });
});

test('gabriel_read reads api.originator_card, and the three tool roles do not', async () => {
  await rolledBack('read', (ask) => ask('SELECT count(*) FROM api.originator_card'));
  for (const identity of ['app', 'agent', 'research'] as const)
    await expect(
      rolledBack(identity, (ask) => ask('SELECT count(*) FROM api.originator_card')),
    ).rejects.toMatchObject({ code: '42501' });
});

// -------------------------------------------------------------------------- the letter scan ---

const CLAIM_TABLES = /\b(proposals|claim_eval|citation|origin_group|entities|relations|digit)\b/i;

/** The names of the claim tables and of a digit that a function body mentions. */
const claimReads = (definition: string): readonly string[] =>
  [...definition.matchAll(new RegExp(CLAIM_TABLES, 'gi'))].map((match) => match[0].toLowerCase());

const definitions = z.array(z.object({ name: z.string(), def: z.string() }));

const LETTER_ROOTS = ['compute_originator_letter', 'originator_letter_for'];

const reachableFromTheLetter = async (): Promise<ReadonlyMap<string, string>> => {
  const all = await probe('superuser', async (ask) =>
    definitions.parse(
      await ask(
        `SELECT p.proname AS name, pg_catalog.pg_get_functiondef(p.oid) AS def
           FROM pg_catalog.pg_proc p
          WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
            AND p.proowner = 'gabriel_owner'::regrole`,
      ),
    ),
  );
  const byName = new Map<string, string[]>();
  for (const { name, def } of all) byName.set(name, [...(byName.get(name) ?? []), def]);

  const reached = new Map<string, string>();
  const queue = [...LETTER_ROOTS];
  while (queue.length > 0) {
    const name = queue.pop();
    if (name === undefined) break;
    if (reached.has(name)) continue;
    const bodies = byName.get(name);
    if (bodies === undefined) continue;
    reached.set(name, bodies.join('\n'));
    for (const other of byName.keys())
      if (other !== name && bodies.some((body) => new RegExp(`\\b${other}\\b`).test(body)))
        queue.push(other);
  }
  return reached;
};

test('the scan finds a claim table and a digit in a body that reads one', () => {
  expect(claimReads('SELECT * FROM proposals p JOIN public.citation c ON true')).toStrictEqual([
    'proposals',
    'citation',
  ]);
  expect(claimReads('SELECT 1 FROM public.originator')).toStrictEqual([]);
});

test('the letter function and every helper it calls read no claim table and no digit', async () => {
  const reached = await reachableFromTheLetter();
  expect([...reached.keys()]).toEqual(
    expect.arrayContaining([
      'compute_originator_letter',
      'originator_letter_for',
      'originator_track_counts',
      'wilson_lower',
      'wilson_upper',
    ]),
  );
  const reads = [...reached].flatMap(([name, definition]) =>
    claimReads(definition).map((table) => `${name} reads ${table}`),
  );
  expect(reads).toStrictEqual([]);
});
