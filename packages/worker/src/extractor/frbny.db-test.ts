import { Pool } from 'pg';
import { afterAll, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { roleAddress } from '../address.ts';
import type { ReaderConfig } from '../reader-config.ts';
import { CHECKER, completionOf, depsOf, routerOf, READER } from '../runner-fixture.ts';
import { openRunner } from '../runner.ts';
import { makeExtractor } from './extractor.ts';

// The case of a staff report of a central bank: a front matter with the authors and their e-mail
// addresses, and a body about the payment rails. The text is SYNTHETIC: each name and each
// address is made up. The answers of the stub model are the faults that a live run gave.
z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const pool = new Pool({ connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD'), max: 1 });

afterAll(async () => {
  await pool.end();
});

const DOCUMENT = 'doc_extractor_staff_report';

const FRONT =
  'Staff Report No. 1047. Payment Rails under Sanctions. Alex Example and Sam Sample. ' +
  'Alex Example: alex.example@bank.example. Sam Sample: sam.sample@bank.example. ' +
  'Abstract: we study how SWIFT and its rivals carry the payments of sanctioned banks. ' +
  'We thank the seminar members for their comments.';

const BODY =
  'After 2022, the banks of Russia lost access to SWIFT. The Bank of Russia operates SPFS, a ' +
  'messaging system for payments. European countries, African countries and Asian countries ' +
  'use SWIFT. Financial sanctions cut the trade of Russia. Alex Example wrote this section. ' +
  'Some SPFS payments settle through SWIFT. Executive Order 14024 designates Ivan Listed, ' +
  'the head of a bank.';

// One part for each page.
const CONFIG: ReaderConfig = {
  reader: READER,
  checker: CHECKER,
  tokenCap: 100_000,
  turnCap: 10,
  chunkCap: 10_000,
};

const item = (ref: string, act: object, page: number, excerpt: string) => ({
  ref,
  act,
  originator: 'Federal Reserve Bank of New York',
  modality: 'asserts',
  evidence: [{ document: DOCUMENT, page, excerpt }],
});

const entity = (
  ref: string,
  type: string,
  label: string,
  page: number,
  excerpt: string,
  attrs?: object,
) =>
  item(
    ref,
    { op: 'create_entity', type, label, ...(attrs === undefined ? {} : { attrs }) },
    page,
    excerpt,
  );

const author = (ref: string, label: string, email: string, page: number, excerpt: string) =>
  entity(ref, 'person', label, page, excerpt, { email: { v: email } });

const FRONT_ANSWER = [
  author('alex', 'Alex Example', 'alex.example@bank.example', 1, 'Alex Example and Sam Sample'),
  author('sam', 'Sam Sample', 'sam.sample@bank.example', 1, 'Alex Example and Sam Sample'),
  author('alex_2', 'Alex Example', 'alex.example@bank.example', 1, 'alex.example@bank.example'),
  entity('swift', 'company', 'SWIFT', 1, 'SWIFT and its rivals'),
];

const BODY_ANSWER = [
  entity('europe', 'state_body', 'European countries', 2, 'European countries'),
  entity('africa', 'state_body', 'African countries', 2, 'African countries'),
  entity('asia', 'state_body', 'Asian countries', 2, 'Asian countries'),
  item(
    'uses',
    { op: 'create_relation', type: 'settles_through', srcId: 'europe', dstId: 'swift_again' },
    2,
    'European countries, African countries and Asian countries use SWIFT',
  ),
  entity('sanctions', 'legal_act', 'Financial sanctions', 2, 'Financial sanctions'),
  entity('trade', 'economic_indicator', 'Trade of Russia', 2, 'the trade of Russia'),
  entity('swift_again', 'company', 'SWIFT', 2, 'lost access to SWIFT'),
  author('alex_3', 'Alex Example', 'alex.example@bank.example', 2, 'Alex Example wrote'),
  entity('cbr', 'state_body', 'Bank of Russia', 2, 'The Bank of Russia operates SPFS'),
  entity('spfs', 'unknown', 'SPFS', 2, 'The Bank of Russia operates SPFS'),
  item(
    'runs',
    { op: 'create_relation', type: 'operates', srcId: 'cbr', dstId: 'spfs' },
    2,
    'The Bank of Russia operates SPFS',
  ),
  // A relation of this part on an entity of the first part. The entity of the first part is a
  // pending proposal, so the model names it again in this part.
  item(
    'settles',
    { op: 'create_relation', type: 'settles_through', srcId: 'spfs', dstId: 'swift_again' },
    2,
    'Some SPFS payments settle through SWIFT',
  ),
  // A person that a sanctions act designates stays, but not the e-mail address of the person.
  entity('eo', 'legal_act', 'Executive Order 14024', 2, 'Executive Order 14024 designates'),
  entity('listed', 'person', 'Ivan Listed', 2, 'designates Ivan Listed', {
    email: { v: 'ivan.listed@firm.example' },
    role: { v: 'head of a bank' },
  }),
  item(
    'designates',
    { op: 'create_relation', type: 'designated_by', srcId: 'listed', dstId: 'eo' },
    2,
    'Executive Order 14024 designates Ivan Listed',
  ),
];

const proposalRow = z.object({ op: z.string(), type: z.string(), label: z.string().nullable() });

test('of the faults of the staff report case, only the facts of the subject become proposals', async () => {
  const client = await pool.connect();
  const logged = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT public.put_document($1, 'file', 'A staff report', 'raw/staff-report.pdf', NULL,
         NULL, NULL, 'application/pdf', '2026-10-01'::date)`,
      [DOCUMENT],
    );
    await client.query('SELECT public.put_document_text($1, $2::jsonb, $3)', [
      DOCUMENT,
      JSON.stringify([FRONT, BODY]),
      'pdf-fixture@1',
    ]);
    const job = z
      .object({ id: z.uuid() })
      .parse(
        (await client.query("SELECT public.enqueue_job($1, 'extract_text') AS id", [DOCUMENT]))
          .rows[0],
      ).id;
    await client.query("UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1", [job]);

    const router = routerOf((call) =>
      completionOf(JSON.stringify({ items: call === 1 ? FRONT_ANSWER : BODY_ANSWER })),
    );
    const extractor = makeExtractor(CONFIG);
    const { deps } = depsOf(client, [extractor], router);
    await client.query('SET LOCAL SESSION AUTHORIZATION gabriel_agent');
    const step = await (await openRunner(deps)).step();
    await client.query('RESET SESSION AUTHORIZATION');

    expect(step).toStrictEqual({ did: 'done', job });
    expect(extractor.version).toBe('v9');
    const rows = z.array(proposalRow).parse(
      (
        await client.query(
          `SELECT p.op, p.payload ->> 'type' AS type, p.payload ->> 'label' AS label
             FROM public.proposals p
            WHERE $1 = ANY (p.src::text[]) ORDER BY p.op, p.payload ->> 'label', p.payload ->> 'type'`,
          [DOCUMENT],
        )
      ).rows,
    );
    expect(rows).toStrictEqual([
      { op: 'create_entity', type: 'state_body', label: 'Bank of Russia' },
      { op: 'create_entity', type: 'legal_act', label: 'Executive Order 14024' },
      { op: 'create_entity', type: 'person', label: 'Ivan Listed' },
      { op: 'create_entity', type: 'unknown', label: 'SPFS' },
      // The SWIFT of the second part joins the pending act of the first part.
      { op: 'create_entity', type: 'company', label: 'SWIFT' },
      { op: 'create_relation', type: 'designated_by', label: null },
      { op: 'create_relation', type: 'operates', label: null },
      { op: 'create_relation', type: 'settles_through', label: null },
    ]);
    // No e-mail address reaches the record.
    const payloads = await client.query(
      'SELECT payload::text AS text FROM public.proposals WHERE $1 = ANY (src::text[])',
      [DOCUMENT],
    );
    expect(JSON.stringify(payloads.rows)).not.toContain('@');
    // The log keeps the count of each drop, with its reason.
    expect(logged).toHaveBeenCalledWith('the agent dropped items', {
      agent: 'extractor',
      job,
      dropped: {
        person_outside_publication_rule: 3,
        duplicate_in_job: 1,
        generic_group: 3,
        generic_concept: 1,
        type_outside_vocabulary: 1,
        names_a_dropped_item: 1,
        email_address: 1,
      },
    });
  } finally {
    logged.mockRestore();
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
});
