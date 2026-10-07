// Departure: the losses the load is known to carry. A test that states a gap fails on the day
// somebody closes the gap and forgets the story, which a comment cannot do.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, rolledBack } from '../probe.ts';

const documents = z.array(z.object({ id: z.string() }));

const NO_JOB = `
  SELECT d.id FROM public.documents d
   WHERE NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.document_id = d.id)
   ORDER BY d.id`;

// Departure: a reserved source has no file and no address, so an agent has nothing to read. The
// seed writes both rows past the door, and the door queues no work for that kind. `inherited` says
// that no document supports the value at all.
test('only the reserved documents carry no work', async () => {
  const held = await probe('superuser', async (ask) => documents.parse(await ask(NO_JOB)));
  expect(held.map((row) => row.id)).toStrictEqual(['inherited', 'manual']);
});

const gaps = z.array(z.object({ rows_that_leave_the_creating_citation: z.coerce.number() }));

// S2, amended 28 September 2026: the row-level list backs the typed columns alone, and an
// attribute's own src backs that one value alone, so the two were split apart and this file's
// second known gap (an untouched row that omitted a value source from its own list) closed —
// the row's own list was never meant to hold a value source. `payload.sources` names the row's
// own citation; a creating act that gives none (no agent proposes a create yet, #25) falls back
// to `src`, its whole citation set, exactly as promote_proposal does.
const SOURCES = `
  WITH renamed AS (
    SELECT u.target_id AS id, u.src, u.decided_at,
           max(u.decided_at) OVER (PARTITION BY u.target_id) AS latest
      FROM public.proposals u
     WHERE u.status = 'accepted' AND u.op = 'update_entity' AND u.target_kind = 'entity'),
  cited AS (
    SELECT id, src FROM renamed WHERE decided_at = latest
    UNION ALL
    SELECT e.id,
           CASE WHEN p.payload ? 'sources'
                THEN ARRAY(SELECT jsonb_array_elements_text(p.payload->'sources'))::doc_id[]
                ELSE p.src END AS src
      FROM public.entities e JOIN public.proposals p ON p.id = e.promoted_from
     WHERE NOT EXISTS (SELECT 1 FROM renamed r WHERE r.id = e.id))
  SELECT (SELECT count(*) FROM public.entities e
           WHERE EXISTS (SELECT 1 FROM cited c WHERE c.id = e.id)
             AND NOT EXISTS (SELECT 1 FROM cited c
                              WHERE c.id = e.id AND c.src::text[] = e.sources::text[]))
           AS rows_that_leave_the_creating_citation`;

// Departure: an accepted update_entity replaces the row list with its own citation, and a rename
// is decided after the creation, so it wins a tie. Two renames with one decided_at pass on either.
test('an entity carries the citation of the act that last set its name or type', async () => {
  const held = await probe('superuser', async (ask) => gaps.parse(await ask(SOURCES)));
  expect(held).toStrictEqual([{ rows_that_leave_the_creating_citation: 0 }]);
});

const picked = z.array(z.object({ target: z.uuid(), outside: z.string() }));
const made = z.array(z.object({ id: z.uuid() }));

const NEVER_RENAMED = `
  SELECT e.id AS target, d.id AS outside
    FROM public.entities e JOIN public.proposals p ON p.id = e.promoted_from
   CROSS JOIN public.documents d
   WHERE d.id NOT IN ('inherited', 'manual')
     AND NOT (d.id = ANY (p.src)) AND NOT (d.id = ANY (e.sources))
     AND NOT EXISTS (SELECT 1 FROM public.proposals u
                      WHERE u.status = 'accepted' AND u.op = 'update_entity'
                        AND u.target_kind = 'entity' AND u.target_id = e.id)
   ORDER BY e.id, d.id LIMIT 1`;

const RENAME = `SELECT public.propose_change('update_entity', '{"label":"A census test"}'::jsonb,
  ARRAY[$1::text], 'entity', $2::uuid) AS id`;

const DECIDED_WITH_THE_CREATION = `
  UPDATE public.proposals u
     SET status = 'accepted', decided_by = 'a test',
         decided_at = (SELECT p.decided_at FROM public.entities e
                         JOIN public.proposals p ON p.id = e.promoted_from
                        WHERE e.id = u.target_id)
   WHERE u.id = $1::uuid`;

const APPLIED = `
  UPDATE public.entities e
     SET label = u.payload->>'label',
         sources = CASE WHEN $2::boolean THEN u.src ELSE e.sources END
    FROM public.proposals u
   WHERE u.id = $1::uuid AND e.id = u.target_id`;

type Promotion = 'replaces the list' | 'keeps the old list';

// External constraint: an act is not decided by the transaction that proposed it, so the test
// writes the decision and the row a promotion writes, and the rollback removes all of it. The
// decision takes the hour of the creation, so the two acts tie.
const censusAfter = (promotion: Promotion) =>
  rolledBack('superuser', async (ask) => {
    const [pick] = picked.parse(await ask(NEVER_RENAMED));
    if (pick === undefined) throw new Error('no created entity has a document outside its list');
    await ask('SET LOCAL SESSION AUTHORIZATION gabriel_app');
    const [act] = made.parse(await ask(RENAME, [pick.outside, pick.target]));
    await ask('RESET SESSION AUTHORIZATION');
    if (act === undefined) throw new Error('the door returned no row');
    await ask(DECIDED_WITH_THE_CREATION, [act.id]);
    await ask(APPLIED, [act.id, promotion === 'replaces the list']);
    return gaps.parse(await ask(SOURCES));
  });

test('a rename that cites another document leaves no row behind its citation', async () => {
  await expect(censusAfter('replaces the list')).resolves.toStrictEqual([
    { rows_that_leave_the_creating_citation: 0 },
  ]);
});

test('a rename whose promotion keeps the old list is reported', async () => {
  await expect(censusAfter('keeps the old list')).resolves.toStrictEqual([
    { rows_that_leave_the_creating_citation: 1 },
  ]);
});

const CITES_OUTSIDE = `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"A gap test",
    "attrs":{"hull_note":{"v":"a test","src":["doc_8f2a41"]}}}'::jsonb,
  ARRAY['doc_9b0417']::text[]) AS id`;

// Departure: the rule that puts every value source in the citation of the act.
test('an act must cite every document its own values cite', async () => {
  await expect(rolledBack('app', (ask) => ask(CITES_OUTSIDE))).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_src_within',
    message: 'each document that a value cites is also a document of the act',
  });
});
