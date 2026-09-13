// What the loads put in the live database: the committed fixture, and whatever corpus was loaded
// above it. The record is the ground every surface and every other database test stands on.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { corpus as fixture } from '../../src/shared/committed-fixture/corpus.ts';
import { fixtureSize } from '../../src/shared/committed-fixture/size.ts';
import { probe } from '../probe.ts';

const census = z.array(
  z.object({
    fixture_documents_missing: z.coerce.number(),
    entities_outside_the_corpus: z.coerce.number(),
    relations_outside_the_corpus: z.coerce.number(),
    pending: z.coerce.number(),
  }),
);

// A corpus entity carries the identifier it held in the record it came from, and a fixture row
// carries none. A corpus relation carries no such mark, so an end of it is what names it.
const CENSUS = `
  SELECT (SELECT count(*) FROM unnest($1::text[]) stated(id)
            WHERE NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.id = stated.id))
           AS fixture_documents_missing,
         (SELECT count(*) FROM public.entities WHERE NOT (attrs ? 'v1_id'))
           AS entities_outside_the_corpus,
         (SELECT count(*) FROM public.relations r
            WHERE NOT EXISTS (SELECT 1 FROM public.entities e
                               WHERE e.attrs ? 'v1_id' AND e.id IN (r.src_id, r.dst_id)))
           AS relations_outside_the_corpus,
         (SELECT count(*) FROM public.proposals WHERE status = 'pending') AS pending`;

test('the record holds the committed fixture whole, whatever was loaded above it', async () => {
  const stated = fixture.documents.map((document) => document.id);
  const held = await probe('superuser', async (ask) => census.parse(await ask(CENSUS, [stated])));
  expect(held).toStrictEqual([
    {
      fixture_documents_missing: 0,
      entities_outside_the_corpus: fixtureSize.entities,
      relations_outside_the_corpus: fixtureSize.relations,
      pending: fixtureSize.pending,
    },
  ]);
});

const authors = z.array(z.object({ status: z.string(), author_role: z.string() }));

const AUTHORS = `
  SELECT DISTINCT status, author_role FROM public.proposals
   WHERE status IN ('pending','accepted') ORDER BY status, author_role`;

test('the pending acts are the machine and the promoted acts are the operator', async () => {
  const held = await probe('superuser', async (ask) => authors.parse(await ask(AUTHORS)));
  expect(held).toStrictEqual([
    { status: 'accepted', author_role: 'gabriel_app' },
    { status: 'pending', author_role: 'gabriel_agent' },
  ]);
});

const shortfalls = z.array(
  z.object({
    entities_with_no_promotion: z.coerce.number(),
    relations_with_no_promotion: z.coerce.number(),
    entities_with_no_source: z.coerce.number(),
    relations_with_no_source: z.coerce.number(),
    entities_typed_unknown: z.coerce.number(),
  }),
);

const SHORTFALLS = `
  SELECT (SELECT count(*) FROM public.entities  WHERE promoted_from IS NULL)
           AS entities_with_no_promotion,
         (SELECT count(*) FROM public.relations WHERE promoted_from IS NULL)
           AS relations_with_no_promotion,
         (SELECT count(*) FROM public.entities
            WHERE sources IS NULL OR cardinality(sources) = 0) AS entities_with_no_source,
         (SELECT count(*) FROM public.relations
            WHERE sources IS NULL OR cardinality(sources) = 0) AS relations_with_no_source,
         (SELECT count(*) FROM public.entities  WHERE type = 'unknown')
           AS entities_typed_unknown`;

test('every element names the act that promoted it and one document, and none is unknown', async () => {
  const held = await probe('superuser', async (ask) => shortfalls.parse(await ask(SHORTFALLS)));
  expect(held).toStrictEqual([
    {
      entities_with_no_promotion: 0,
      relations_with_no_promotion: 0,
      entities_with_no_source: 0,
      relations_with_no_source: 0,
      entities_typed_unknown: 0,
    },
  ]);
});

const queue = z.array(
  z.object({
    jobs: z.coerce.number(),
    queued: z.coerce.number(),
    taken: z.coerce.number(),
    jobs_with_no_document: z.coerce.number(),
    documents_queued_twice: z.coerce.number(),
  }),
);

const QUEUE = `
  SELECT (SELECT count(*) FROM public.jobs)                          AS jobs,
         (SELECT count(*) FROM public.jobs WHERE status =  'queued') AS queued,
         (SELECT count(*) FROM public.jobs WHERE status <> 'queued') AS taken,
         (SELECT count(*) FROM public.jobs j
            WHERE NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.id = j.document_id))
           AS jobs_with_no_document,
         (SELECT count(*) FROM (SELECT document_id FROM public.jobs
             GROUP BY document_id HAVING count(*) > 1) twice) AS documents_queued_twice`;

// The door queues one job for each document it writes. No path returns a taken row to the queue,
// so a `taken` above zero is work that a claim removed and nothing gave back. Without this the
// loss shows up much later, as a claim test that accuses SKIP LOCKED of a fault it has not.
test('the load queued one job for each document, and nothing has taken one', async () => {
  const [held] = await probe('superuser', async (ask) => queue.parse(await ask(QUEUE)));
  if (held === undefined) throw new Error('the queue answered no census row');

  expect(held.queued).toBe(held.jobs);
  expect(held.jobs).toBeGreaterThan(0);
  expect({
    taken: held.taken,
    jobs_with_no_document: held.jobs_with_no_document,
    documents_queued_twice: held.documents_queued_twice,
  }).toStrictEqual({ taken: 0, jobs_with_no_document: 0, documents_queued_twice: 0 });
});

const ends = z.array(z.object({ type: z.string(), src_kind: z.string(), dst_kind: z.string() }));

const RELATION_ENDS = `
  SELECT r.type, r.src_kind, r.dst_kind
    FROM public.relations r
   WHERE (r.src_kind = 'relation' AND EXISTS
            (SELECT 1 FROM public.relations x WHERE x.id = r.src_id))
      OR (r.dst_kind = 'relation' AND EXISTS
            (SELECT 1 FROM public.relations x WHERE x.id = r.dst_id))
   ORDER BY r.type, r.src_kind, r.dst_kind`;

test('two relations point at a relation, and both endpoints resolve', async () => {
  const held = await probe('superuser', async (ask) => ends.parse(await ask(RELATION_ENDS)));
  expect(held).toStrictEqual([
    { type: 'contradicts', src_kind: 'entity', dst_kind: 'relation' },
    { type: 'contradicts', src_kind: 'entity', dst_kind: 'relation' },
  ]);
});
