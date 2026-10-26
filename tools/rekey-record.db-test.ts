// A row of the record that holds former_names as one text is corrected by a new act, never by an
// edit of the history: an update_attrs act with the list replaces the value when the operator
// accepts it, and the accepted act keeps the old text in prior_value. The statements commit,
// because an act is not decided by the transaction that proposed it, and the entity is removed at
// the end (the ledger keeps its rows).

import { expect, test } from 'vitest';
import { z } from 'zod';

import { propose } from '@gab/tools/propose';
import { callTool } from '@gab/tools/tool';

import { probe, type Ask } from './probe.ts';

const SHA = 'ab'.repeat(32);
const DOC = `doc_${SHA.slice(0, 12)}`;
const TODAY = new Date().toISOString().slice(0, 10);
const TEXT = 'Former names: Ocean Unicorn, Wellington, Khalissa, Bai Lu';
const OLD = 'Ocean Unicorn / Wellington / Khalissa / Bai Lu';
const NAMES = ['Ocean Unicorn', 'Wellington', 'Khalissa', 'Bai Lu'];

const idOf = z.array(z.object({ id: z.uuid() }));
const first = async (ask: Ask, text: string, values: readonly unknown[]): Promise<string> => {
  const [row] = idOf.parse(await ask(text, values));
  if (row === undefined) throw new Error('the statement returned no row');
  return row.id;
};

const PROPOSE = `SELECT public.propose_change($1, $2::jsonb, ARRAY['manual']::text[], $3::text,
  $4::uuid) AS id`;
const PROMOTE = 'SELECT public.promote_unit($1::uuid, $2::text) AS id';

test('a new update_attrs act with the list replaces the text, and keeps the text in prior_value', async () => {
  const found = await probe('app', async (app) => {
    const entity = await first(app, PROPOSE, [
      'create_entity',
      JSON.stringify({
        type: 'vessel',
        label: 'Record correction test',
        attrs: { former_names: { v: OLD, src: ['manual'] } },
      }),
      null,
      null,
    ]);
    await first(app, PROMOTE, [entity, 'a test']);
    try {
      const act = await probe('research', async (research) => {
        await research(
          'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, $8) AS id',
          [
            'url',
            'A record correction test',
            `raw/${SHA}`,
            'https://example.org/record-correction',
            SHA,
            'application/pdf',
            TODAY,
            null,
          ],
        );
        await research('SELECT public.put_document_text($1, $2::jsonb, $3) AS pages', [
          DOC,
          JSON.stringify([TEXT]),
          'record-correction-1',
        ]);
        const outcome = await callTool(
          propose,
          { query: async (text, values) => ({ rows: await research(text, values) }) },
          {
            items: [
              {
                ref: 'fix',
                act: {
                  op: 'update_attrs',
                  targetKind: 'entity',
                  targetId: entity,
                  attrs: { former_names: { v: NAMES } },
                },
                originator: 'script rekey-attributes',
                modality: 'asserts',
                evidence: [{ document: DOC, page: 1, excerpt: TEXT }],
              },
            ],
          },
        );
        if (!outcome.ok) throw new Error(`propose refused: ${outcome.refusal}`);
        return z
          .object({ proposals: z.array(z.object({ proposalId: z.uuid() })) })
          .parse(outcome.output).proposals[0]?.proposalId;
      });
      if (act === undefined) throw new Error('propose wrote no act');
      const [unit] = z
        .array(z.object({ unit_id: z.uuid() }))
        .parse(await app('SELECT unit_id FROM public.proposals WHERE id = $1', [act]));
      await first(app, PROMOTE, [unit?.unit_id, 'a test']);
      const [row] = z
        .array(
          z.object({
            status: z.string(),
            prior: z.unknown(),
            held: z.unknown(),
          }),
        )
        .parse(
          await app(
            `SELECT p.status, p.prior_value->'former_names'->'v' AS prior,
                    e.attrs->'former_names'->'v' AS held
               FROM public.proposals p JOIN public.entities e ON e.id = p.target_id
              WHERE p.id = $1`,
            [act],
          ),
        );
      return row;
    } finally {
      await first(app, PROMOTE, [
        await first(app, PROPOSE, ['delete_entity', '{}', 'entity', entity]),
        'a test',
      ]);
    }
  });
  expect(found).toStrictEqual({ status: 'accepted', prior: OLD, held: NAMES });
});
