// The history merge and the bare record entities, on the doors of the database. Each test runs
// inside a transaction that rolls back, so the corpus stays as it was.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { propose } from '@gab/tools/propose';
import { callTool, type Session } from '@gab/tools/tool';

import { rolledBack, type Ask } from './probe.ts';
import { readBare, readHistory, replace } from './rekey-history.ts';
import { doorsOf } from './rekey-write.ts';

const TODAY = new Date().toISOString().slice(0, 10);
const NEW = { sha: 'd'.repeat(64) } as const;
const OLD = { sha: 'e'.repeat(64) } as const;
const doc = (sha: string): string => `doc_${sha.slice(0, 12)}`;

// The shape of a page: a main block, and then the block of the false data of the vessel.
const NEW_PAGE = [
  'Vessel NS Leader',
  'IMO: 9441489',
  'MMSI: 273456789',
  'Call sign: UBXP',
  'Build year: 2008',
  'False data used by the vessel',
  'Flag: Panama',
  'MMSI: 351000001',
].join('\n');
const OLD_PAGE = 'Vessel NS Leader\nMMSI 215000111\nFlag Malta';
const OWNER_PAGE = 'Owner of the vessel\nIMO company number: 1234567\nAddress: Moscow';
const OWNER = { sha: 'f'.repeat(64) } as const;

const sessionAs = (ask: Ask, role: string): Session => ({
  query: async (text, values) => {
    await ask(`SET LOCAL SESSION AUTHORIZATION ${role}`);
    try {
      return { rows: await ask(text, values) };
    } finally {
      await ask('RESET SESSION AUTHORIZATION').catch(() => undefined);
    }
  },
});

const STORE = 'SELECT public.put_fetched_document($1, $2, $3, $4, $5, $6, $7::date, $8) AS id';
const WRITE_TEXT = 'SELECT public.put_document_text($1, $2::jsonb, $3) AS pages';

const store = async (ask: Ask, sha: string, text: string): Promise<void> => {
  const research = sessionAs(ask, 'gabriel_research');
  await research.query(STORE, [
    'url',
    `A page of the history test ${sha.slice(0, 4)}`,
    `raw/${sha}`,
    `https://example.org/history-${sha.slice(0, 4)}`,
    sha,
    'application/pdf',
    TODAY,
    null,
  ]);
  await research.query(WRITE_TEXT, [
    doc(sha),
    JSON.stringify([text]),
    `history-${sha.slice(0, 4)}`,
  ]);
};

const recorded = async (ask: Ask, type: string, label: string, attrs: object): Promise<string> => {
  const [made] = z
    .array(z.object({ id: z.uuid() }))
    .parse(
      (
        await sessionAs(ask, 'gabriel_app').query(
          "SELECT public.propose_change('create_entity', $1::jsonb, ARRAY['manual']::text[]) AS id",
          [JSON.stringify({ type, label })],
        )
      ).rows,
    );
  const [row] = z.array(z.object({ id: z.uuid() })).parse(
    await ask(
      `INSERT INTO public.entities (id, type, label, attrs, sources, promoted_from)
       VALUES ($4, $1, $2, $3::jsonb, ARRAY['${doc(OLD.sha)}']::text[]::doc_id[], $4) RETURNING id`,
      [type, label, JSON.stringify(attrs), made?.id],
    ),
  );
  return row?.id ?? '';
};

const send = async (ask: Ask, item: Record<string, unknown>): Promise<string> => {
  const outcome = await callTool(propose, sessionAs(ask, 'gabriel_research'), { items: [item] });
  if (!outcome.ok) throw new Error(`propose refused: ${outcome.refusal}`);
  const [one] = z
    .object({ proposals: z.array(z.object({ proposalId: z.uuid() })) })
    .parse(outcome.output).proposals;
  if (one === undefined) throw new Error('propose wrote no act');
  return one.proposalId;
};

const stateOf = async (ask: Ask, id: string) =>
  z
    .array(
      z.object({
        status: z.string(),
        reject_note: z.string().nullable(),
        payload: z.record(z.string(), z.unknown()),
      }),
    )
    .parse(
      await ask('SELECT status, reject_note, payload FROM public.proposals WHERE id = $1::uuid', [
        id,
      ]),
    )[0];

test('a pending act with a call sign and an MMSI is replaced by an act with the merged list', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await store(ask, NEW.sha, NEW_PAGE);
    await store(ask, OLD.sha, OLD_PAGE);
    const vessel = await recorded(ask, 'vessel', 'NS Leader', {
      imo: { v: '9441489', src: ['manual'] },
      mmsi_history: { v: ['215000111'], src: [doc(OLD.sha)] },
      call_sign: { v: 'ABCD', src: ['manual'] },
    });
    const old = await send(ask, {
      ref: 'a1',
      act: {
        op: 'update_attrs',
        targetKind: 'entity',
        targetId: vessel,
        attrs: { mmsi_history: { v: '273456789' }, call_sign: { v: 'UBXP' } },
      },
      originator: 'The port authority',
      modality: 'asserts',
      evidence: [
        {
          document: doc(NEW.sha),
          page: 1,
          excerpt: 'IMO: 9441489\nMMSI: 273456789\nCall sign: UBXP',
        },
      ],
    });
    const planned = await readHistory(sessionAs(ask, 'gabriel_app'));
    const mine = planned.find((one) => one.act.id === old);
    if (mine?.plan.kind !== 'send') throw new Error(`not ready: ${JSON.stringify(mine?.plan)}`);
    const result = await replace(
      mine.plan.value,
      doorsOf(sessionAs(ask, 'gabriel_research'), sessionAs(ask, 'gabriel_app')),
    );
    const fresh = z
      .array(z.object({ id: z.uuid(), payload: z.record(z.string(), z.unknown()) }))
      .parse(
        await ask(
          `SELECT id, payload FROM public.proposals
            WHERE status = 'pending' AND target_id = $1::uuid AND id <> $2::uuid`,
          [vessel, old],
        ),
      );
    return { result, left: mine.plan.value.left, old: await stateOf(ask, old), fresh };
  });
  expect(found.result).toMatchObject({ status: 'done', sent: 1, rejected: 1 });
  expect(found.left).toEqual(['call_sign']);
  expect(found.old?.status).toBe('rejected');
  expect(found.old?.reject_note).toContain('replaced by the act');
  expect(found.fresh).toHaveLength(1);
  // The call sign is out, and the new value cites the page and the source of the old MMSI.
  expect(found.fresh[0]?.payload['attrs']).toEqual({
    mmsi_history: {
      v: ['215000111', '273456789'],
      src: [doc(NEW.sha), doc(OLD.sha)],
    },
  });
});

test('a bare company of the record gets its number from the page of a refused act', async () => {
  const found = await rolledBack('superuser', async (ask) => {
    await store(ask, OWNER.sha, OWNER_PAGE);
    const company = await recorded(ask, 'company', 'Volgoneft LLC', {});
    const refused = await send(ask, {
      ref: 'a1',
      act: {
        op: 'update_attrs',
        targetKind: 'entity',
        targetId: company,
        attrs: { imo_company_number: { v: '1234567' } },
      },
      originator: 'The port authority',
      modality: 'asserts',
      evidence: [{ document: doc(OWNER.sha), page: 1, excerpt: 'IMO company number: 1234567' }],
    });
    await sessionAs(ask, 'gabriel_app').query('SELECT public.reject_unit($1::uuid, $2, $3, $4)', [
      refused,
      'other',
      'a test',
      'a test',
    ]);
    const planned = (await readBare(sessionAs(ask, 'gabriel_app'), true, TODAY)).find(
      (one) => one.entity.id === company,
    );
    if (planned?.plan.kind !== 'send')
      throw new Error(`not ready: ${JSON.stringify(planned?.plan)}`);
    const result = await replace(
      planned.plan.value,
      doorsOf(sessionAs(ask, 'gabriel_research'), sessionAs(ask, 'gabriel_app')),
    );
    const fresh = z
      .array(z.object({ payload: z.record(z.string(), z.unknown()) }))
      .parse(
        await ask(
          `SELECT payload FROM public.proposals WHERE status = 'pending' AND target_id = $1::uuid`,
          [company],
        ),
      );
    return { result, fresh };
  });
  expect(found.result).toMatchObject({ status: 'done', sent: 1, rejected: 0 });
  expect(found.fresh.map((one) => one.payload['attrs'])).toEqual([
    { imo_company_number: { v: '1234567', src: [doc(OWNER.sha)] } },
  ]);
});
