import { z } from 'zod';

export default interface Job {
  id: string | null;

  document_id: string | null;

  status: string | null;

  attempts: number | null;

  claimed_by: string | null;

  claimed_at: string | null;

  failure_reason: string | null;

  finished_at: string | null;
}

export const job = z.object({
  id: z.uuid().nullable(),
  document_id: z.string().nullable(),
  status: z.string().nullable(),
  attempts: z.number().nullable(),
  claimed_by: z.string().nullable(),
  claimed_at: z.string().nullable(),
  failure_reason: z.string().nullable(),
  finished_at: z.string().nullable(),
});
