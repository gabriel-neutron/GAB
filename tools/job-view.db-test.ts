import { expect, test } from 'vitest';
import { z } from 'zod';

import { probe, type Ask } from './probe.ts';

const DOCUMENT = 'doc_job_view_failure';

const REASON = 'A test of the job view: the source answered 404';

const PUT = `SELECT public.put_document($1, 'file', 'A test of the job view',
  'raw/job-view.pdf', NULL, NULL, NULL, 'application/pdf', '2026-09-26'::date) AS id`;

const ENQUEUE = "SELECT public.enqueue_job($1, 'extract_text') AS id";

const claimed = z.array(z.object({ job_id: z.uuid(), job_document: z.string() }));

const shown = z.array(
  z.object({ status: z.string(), failure_reason: z.string().nullable(), ended_now: z.boolean() }),
);

// External constraint: now() is the hour the transaction began, and fail_job reads the same.
const SHOWN = `SELECT status, failure_reason, finished_at = now() AS ended_now
  FROM api.job WHERE id = $1`;

// Departure: the claim takes the oldest queued row, so the rows before this one are claimed too.
const claimUntil = async (ask: Ask, document: string): Promise<string> => {
  for (;;) {
    const [row] = claimed.parse(await ask('SELECT * FROM public.claim_job()'));
    if (row === undefined) throw new Error(`The queue held no job for ${document}.`);
    if (row.job_document === document) return row.job_id;
  }
};

// External constraint: one connection sees the rows of its own open transaction only, so the
// superuser claims and fails the job, then reads as the research role, and the rollback removes
// all. The public read role does not read a job.
test('a failed job shows its reason and its end hour to the research role', async () => {
  const rows = await probe('superuser', async (ask) => {
    await ask('BEGIN');
    try {
      await ask(PUT, [DOCUMENT]);
      await ask(ENQUEUE, [DOCUMENT]);
      const job = await claimUntil(ask, DOCUMENT);
      await ask('SELECT public.fail_job($1, $2)', [job, REASON]);
      await ask('SET LOCAL ROLE gabriel_research');
      return shown.parse(await ask(SHOWN, [job]));
    } finally {
      await ask('ROLLBACK');
    }
  });
  expect(rows).toStrictEqual([{ status: 'failed', failure_reason: REASON, ended_now: true }]);
});
