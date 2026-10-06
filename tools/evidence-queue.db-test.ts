// The check job of a document runs after its readers. The claim door holds it back while a reader
// of the same document is queued or running, and it changes the order of no other job.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { aDocument, asRole, idOf } from './evidence-fixture.ts';
import { rolledBack, type Ask } from './probe.ts';

const DOC = 'doc_evidence_queue';
const OTHER = 'doc_evidence_queue_other';

const claimed = z.array(z.object({ job_id: z.uuid(), job_kind: z.string() })).max(1);

const claimOne = (ask: Ask): Promise<z.output<typeof claimed>> =>
  asRole(ask, 'gabriel_agent', async () =>
    claimed.parse(await ask('SELECT job_id, job_kind FROM public.claim_job()')),
  );

// The test holds the oldest rows of the queue, so a row of the fixture never answers first.
const queuedJob = async (
  ask: Ask,
  document: string,
  kind: string,
  age: string,
): Promise<string> => {
  const id = await idOf(ask, 'SELECT public.enqueue_job($1, $2)::text AS id', [document, kind]);
  await ask('UPDATE public.jobs SET created_at = $2::timestamptz WHERE id = $1', [id, age]);
  return id;
};

const finish = async (ask: Ask, id: string): Promise<void> => {
  await ask(
    `UPDATE public.jobs SET status = 'done', attempts = 1, claimed_by = 'gabriel_agent',
       claimed_at = now(), finished_at = now() WHERE id = $1`,
    [id],
  );
};

test('enqueue_job accepts the kind evidence_check', async () => {
  const kinds = await rolledBack('superuser', async (ask) => {
    await aDocument(ask, { id: DOC, pages: ['A page.'] });
    await queuedJob(ask, DOC, 'evidence_check', '1970-01-01');
    return ask("SELECT kind FROM public.jobs WHERE document_id = $1 AND status = 'queued'", [DOC]);
  });
  expect(kinds).toStrictEqual([{ kind: 'evidence_check' }]);
});

test('claim_job does not return a check job while a reader of its document is queued', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await aDocument(ask, { id: DOC, pages: ['A page.'] });
    const evidence = await queuedJob(ask, DOC, 'evidence_check', '1970-01-01 00:00:00');
    const reader = await queuedJob(ask, DOC, 'second_read', '1970-01-01 00:00:01');
    const first = await claimOne(ask);
    return { evidence, reader, first };
  });
  expect(seen.first).toStrictEqual([{ job_id: seen.reader, job_kind: 'second_read' }]);
});

test('claim_job does not return a check job while a reader of its document is running', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await aDocument(ask, { id: DOC, pages: ['A page.'] });
    await queuedJob(ask, DOC, 'extract_text', '1970-01-01 00:00:00');
    await queuedJob(ask, DOC, 'evidence_check', '1970-01-01 00:00:01');
    const first = await claimOne(ask);
    const second = await claimOne(ask);
    return { first, second };
  });
  expect(seen.first[0]?.job_kind).toBe('extract_text');
  expect(seen.second[0]?.job_kind).not.toBe('evidence_check');
});

test('claim_job returns the check job once each reader of its document has ended', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await aDocument(ask, { id: DOC, pages: ['A page.'] });
    const reader = await queuedJob(ask, DOC, 'extract_text', '1970-01-01 00:00:00');
    const second = await queuedJob(ask, DOC, 'second_read', '1970-01-01 00:00:01');
    const evidence = await queuedJob(ask, DOC, 'evidence_check', '1970-01-01 00:00:02');
    await finish(ask, reader);
    await ask(
      `UPDATE public.jobs SET status = 'failed', attempts = 1, claimed_by = 'gabriel_agent',
         claimed_at = now(), finished_at = now(), failure_reason = 'a test' WHERE id = $1`,
      [second],
    );
    return { evidence, first: await claimOne(ask) };
  });
  expect(seen.first).toStrictEqual([{ job_id: seen.evidence, job_kind: 'evidence_check' }]);
});

test('a reader of another document does not hold the check job back', async () => {
  const seen = await rolledBack('superuser', async (ask) => {
    await aDocument(ask, { id: DOC, pages: ['A page.'] });
    await aDocument(ask, { id: OTHER, pages: ['Another page.'] });
    const evidence = await queuedJob(ask, DOC, 'evidence_check', '1970-01-01 00:00:00');
    await queuedJob(ask, OTHER, 'extract_text', '1970-01-01 00:00:01');
    return { evidence, first: await claimOne(ask) };
  });
  expect(seen.first).toStrictEqual([{ job_id: seen.evidence, job_kind: 'evidence_check' }]);
});
