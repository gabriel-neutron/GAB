import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

const READ = `SELECT job_id::text AS id, lead, lead_by, job_status AS status, job_reason AS reason,
         created_at::text AS created_at, documents
    FROM public.lead_jobs()`;

const document = z.object({ id: z.string(), title: z.string(), url: z.string().nullable() });

const row = z.object({
  id: z.uuid(),
  lead: z.string(),
  lead_by: z.string(),
  status: z.string(),
  reason: z.string().nullable(),
  created_at: z.string(),
  documents: z.array(document),
});

export const readLeads = defineTool({
  name: 'read_leads',
  description:
    'Reads the leads, the newest first: the text of each lead, the role that started it (the ' +
    'operator or the research AI), its status, the reason of a failure, and the documents that ' +
    'it stored. find_document and list_proposals give what each document holds.',
  input: z.strictObject({}),
  output: z.strictObject({
    leads: z.array(
      z.strictObject({
        id: z.uuid(),
        lead: z.string(),
        by: z.string(),
        status: z.string(),
        failureReason: z.string().nullable(),
        startedAt: z.string(),
        documents: z.array(document),
      }),
    ),
  }),
  async run(session) {
    const found = await rowsOf(session, row, READ, []);
    return {
      leads: found.map((held) => ({
        id: held.id,
        lead: held.lead,
        by: held.lead_by,
        status: held.status,
        failureReason: held.reason,
        startedAt: held.created_at,
        documents: held.documents,
      })),
    };
  },
});
