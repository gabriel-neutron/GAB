import { Pool } from 'pg';
import { afterAll, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { roleAddress } from '../address.ts';
import type { ReaderConfig } from '../reader-config.ts';
import { CHECKER, completionOf, depsOf, routerOf, READER } from '../runner-fixture.ts';
import { openRunner } from '../runner.ts';
import { makeExtractor } from './extractor.ts';

// The case of a sectoral measure: an OFAC directive identifies a bank, and it freezes no asset.
// The text is SYNTHETIC: each name is made up. The stub model gives the answer that the prompt
// asks for, and the test shows what the record keeps of it.
z.object({ GABRIEL_DATABASE: z.literal('gabriel_test') }).parse(process.env);
const pool = new Pool({ connectionString: roleAddress('gabriel', 'POSTGRES_PASSWORD'), max: 1 });

afterAll(async () => {
  await pool.end();
});

const DOCUMENT = 'doc_extractor_sectoral';

const PAGE =
  'On 24 February 2022, OFAC identified Test Bank JSC under Directive 3 under Executive ' +
  'Order 14024. Pat Officer is the chair of Test Bank JSC. The directive prohibits new debt ' +
  'of more than 14 days.';

const CONFIG: ReaderConfig = {
  reader: READER,
  checker: CHECKER,
  tokenCap: 100_000,
  turnCap: 10,
  chunkCap: 10_000,
};

const item = (ref: string, act: object, excerpt: string) => ({
  ref,
  act,
  originator: 'Office of Foreign Assets Control',
  modality: 'enacts',
  evidence: [{ document: DOCUMENT, page: 1, excerpt }],
});

const DIRECTIVE = 'OFAC identified Test Bank JSC under Directive 3 under Executive Order 14024';

const ANSWER = [
  item('bank', { op: 'create_entity', type: 'bank', label: 'Test Bank JSC' }, DIRECTIVE),
  item(
    'directive',
    { op: 'create_entity', type: 'legal_act', label: 'Directive 3 under Executive Order 14024' },
    DIRECTIVE,
  ),
  item(
    'restricted',
    {
      op: 'create_relation',
      type: 'restricted_by',
      srcId: 'bank',
      dstId: 'directive',
      validFrom: '2022-02-24',
    },
    `On 24 February 2022, ${DIRECTIVE}`,
  ),
  // A sectoral measure names no person, so it never lets a person into the record.
  item(
    'chair',
    { op: 'create_entity', type: 'person', label: 'Pat Officer' },
    'Pat Officer is the chair',
  ),
  item(
    'chair_restricted',
    { op: 'create_relation', type: 'restricted_by', srcId: 'chair', dstId: 'directive' },
    DIRECTIVE,
  ),
];

const proposalRow = z.object({
  op: z.string(),
  type: z.string(),
  label: z.string().nullable(),
  valid_from: z.string().nullable(),
});

const asked = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.string() }).loose()),
});

const words = z.object({ datedRelationTypes: z.array(z.string()) });

test('a sectoral measure becomes a restricted_by relation with its date, and lets no person in', async () => {
  const client = await pool.connect();
  const logged = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT public.put_document($1, 'file', 'A directive', 'raw/directive.pdf', NULL,
         NULL, NULL, 'application/pdf', '2026-10-01'::date)`,
      [DOCUMENT],
    );
    await client.query('SELECT public.put_document_text($1, $2::jsonb, $3)', [
      DOCUMENT,
      JSON.stringify([PAGE]),
      'pdf-fixture@1',
    ]);
    const job = z
      .object({ id: z.uuid() })
      .parse(
        (await client.query("SELECT public.enqueue_job($1, 'extract_text') AS id", [DOCUMENT]))
          .rows[0],
      ).id;
    await client.query("UPDATE public.jobs SET created_at = '1970-01-01' WHERE id = $1", [job]);

    const bodies: string[] = [];
    const router = routerOf((_call, body) => {
      bodies.push(body);
      return completionOf(JSON.stringify({ items: ANSWER }));
    });
    const { deps } = depsOf(client, [makeExtractor(CONFIG)], router);
    await client.query('SET LOCAL SESSION AUTHORIZATION gabriel_agent');
    const step = await (await openRunner(deps)).step();
    await client.query('RESET SESSION AUTHORIZATION');
    expect(step).toStrictEqual({ did: 'done', job });

    // The model gets the rule and the type, with its dates.
    const { messages } = asked.parse(JSON.parse(bodies[0] ?? '{}'));
    const prompt = messages
      .map((one) => one.content)
      .join(' ')
      .replace(/\s+/gu, ' ');
    expect(prompt).toContain('For a vessel, it is an entry on the vessel list of a regime');
    expect(prompt).toContain(
      'Any other sectoral measure freezes no asset, and it is `restricted_by`',
    );
    expect(words.parse(JSON.parse(messages.at(-1)?.content ?? '{}')).datedRelationTypes).toContain(
      'restricted_by',
    );

    const rows = z.array(proposalRow).parse(
      (
        await client.query(
          `SELECT p.op, p.payload ->> 'type' AS type, p.payload ->> 'label' AS label,
                  p.payload ->> 'valid_from' AS valid_from
             FROM public.proposals p
            WHERE $1 = ANY (p.src::text[]) ORDER BY p.op, p.payload ->> 'label'`,
          [DOCUMENT],
        )
      ).rows,
    );
    expect(rows).toStrictEqual([
      {
        op: 'create_entity',
        type: 'legal_act',
        label: 'Directive 3 under Executive Order 14024',
        valid_from: null,
      },
      { op: 'create_entity', type: 'bank', label: 'Test Bank JSC', valid_from: null },
      { op: 'create_relation', type: 'restricted_by', label: null, valid_from: '2022-02-24' },
    ]);
  } finally {
    logged.mockRestore();
    try {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
});
