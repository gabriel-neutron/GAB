// The two losses the load is known to carry. A test that states a gap fails on the day somebody
// closes the gap and forgets the story, which a comment cannot do.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe } from '../probe.ts';

const rated = z.array(z.object({ rated_documents: z.coerce.number() }));

const RATED = `
  SELECT count(*) AS rated_documents FROM public.documents
   WHERE admiralty IS NOT NULL OR admiralty_origin IS NOT NULL`;

test('no document carries an Admiralty rating', async () => {
  const held = await probe('superuser', async (ask) => rated.parse(await ask(RATED)));
  expect(held).toStrictEqual([{ rated_documents: 0 }]);
});

const parameters = z.array(z.object({ parameter: z.string() }));

const PUT_DOCUMENT_TAKES = `
  SELECT unnest(p.proargnames) AS parameter
    FROM pg_catalog.pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'put_document'`;

// The cause of the loss above, and not a second reading of it. The one ingestion door has no
// parameter to carry a rating, so no rating can arrive with a document.
test('the ingestion door takes no rating parameter', async () => {
  const taken = await probe('superuser', async (ask) =>
    parameters.parse(await ask(PUT_DOCUMENT_TAKES)).map((row) => row.parameter),
  );
  expect(taken).toStrictEqual([
    'p_id',
    'p_kind',
    'p_title',
    'p_s3_key',
    'p_uri',
    'p_archive_uri',
    'p_sha256',
    'p_mime',
    'p_retrieved_at',
  ]);
});

const gaps = z.array(
  z.object({
    rows_that_leave_the_creating_citation: z.coerce.number(),
    untouched_rows_that_omit_a_value_source: z.coerce.number(),
  }),
);

const SOURCES = `
  WITH untouched AS (
    SELECT e.sources::text[] AS own_src,
           (SELECT array_agg(DISTINCT s) FROM jsonb_each(e.attrs) kv,
              jsonb_array_elements_text(coalesce(kv.value->'src','[]'::jsonb)) s) AS value_src
      FROM public.entities e
     WHERE NOT EXISTS (SELECT 1 FROM public.proposals u
                        WHERE u.status = 'accepted' AND u.op = 'update_attrs'
                          AND u.target_kind = 'entity' AND u.target_id = e.id))
  SELECT (SELECT count(*) FROM public.entities e JOIN public.proposals p ON p.id = e.promoted_from
           WHERE e.sources::text[] <> p.src::text[])
           AS rows_that_leave_the_creating_citation,
         (SELECT count(*) FROM untouched WHERE NOT (own_src @> value_src))
           AS untouched_rows_that_omit_a_value_source`;

// The row list is the citation of the creating act and nothing more. A promotion of an update
// never extends it, so an entity an update touched can omit a document its own value cites.
test('an entity carries the citation of the act that created it', async () => {
  const held = await probe('superuser', async (ask) => gaps.parse(await ask(SOURCES)));
  expect(held).toStrictEqual([
    { rows_that_leave_the_creating_citation: 0, untouched_rows_that_omit_a_value_source: 0 },
  ]);
});

const CITES_OUTSIDE = `SELECT public.propose_change('create_entity',
  '{"type":"vessel","label":"A gap test",
    "attrs":{"hull_note":{"v":"a test","src":["doc_8f2a41"]}}}'::jsonb,
  ARRAY['doc_9b0417']::text[]) AS id`;

// The rule that puts every value source in the citation of the act. The call runs inside a
// transaction that rolls back, because the proposals ledger is append-only.
test('an act must cite every document its own values cite', async () => {
  await expect(
    probe('app', async (ask) => {
      await ask('BEGIN');
      try {
        return await ask(CITES_OUTSIDE);
      } finally {
        await ask('ROLLBACK');
      }
    }),
  ).rejects.toMatchObject({
    code: '23514',
    constraint: 'proposals_src_within',
    message: 'new row for relation "proposals" violates check constraint "proposals_src_within"',
  });
});
