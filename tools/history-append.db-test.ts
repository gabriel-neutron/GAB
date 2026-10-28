// An update of a history key of a vessel adds its values to the values of the record. The
// test signs each act, so each act is promoted at once, and the transaction rolls back.

import { expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from './probe.ts';

const made = z.array(z.object({ target_id: z.uuid() }));
const attrsOf = z.array(z.object({ attrs: z.record(z.string(), z.unknown()) }));

// A document of the committed fixture, which each test database holds.
const FIXTURE_DOCUMENT = 'doc_3c1104';

const created = async (ask: Ask, attrs: object): Promise<string> => {
  const [row] = made.parse(
    await ask(
      `SELECT * FROM public.sign_change('a test', 'create_entity', $1::jsonb, ARRAY['manual'],
         NULL, NULL, '{}')`,
      [JSON.stringify({ type: 'vessel', label: 'HISTORY TEST', attrs, sources: ['manual'] })],
    ),
  );
  if (row === undefined) throw new Error('the vessel was not created');
  return row.target_id;
};

const updated = (ask: Ask, target: string, attrs: object) =>
  ask(
    `SELECT * FROM public.sign_change('a test', 'update_attrs', $1::jsonb, $3::text[],
       'entity', $2::uuid, '{}')`,
    [JSON.stringify({ attrs }), target, [FIXTURE_DOCUMENT]],
  );

const attrsNow = async (ask: Ask, id: string) =>
  attrsOf.parse(await ask('SELECT attrs FROM public.entities WHERE id = $1', [id]))[0]?.attrs;

test('an update adds the new MMSI and call sign, and keeps each old value and its source', async () => {
  const attrs = await rolledBack('app', async (ask) => {
    const id = await created(ask, {
      imo: { v: '9000002', src: ['manual'] },
      mmsi_history: { v: ['111111111', '222222222'], src: ['manual'] },
      call_sign: { v: 'OLD1', src: ['manual'] },
    });
    await updated(ask, id, {
      mmsi_history: { v: '333333333', src: [FIXTURE_DOCUMENT] },
      call_sign: { v: ['OLD1', 'NEW2'], src: [FIXTURE_DOCUMENT] },
      imo: { v: '9000003', src: [FIXTURE_DOCUMENT] },
    });
    return attrsNow(ask, id);
  });
  expect(attrs).toMatchObject({
    mmsi_history: { v: ['111111111', '222222222', '333333333'], src: ['manual', FIXTURE_DOCUMENT] },
    call_sign: { v: ['OLD1', 'NEW2'], src: ['manual', FIXTURE_DOCUMENT] },
    // A key that is no history is still replaced.
    imo: { v: '9000003', src: [FIXTURE_DOCUMENT] },
  });
});

test('an update that adds no value to a history key keeps the value of the record as it is', async () => {
  const attrs = await rolledBack('app', async (ask) => {
    const id = await created(ask, {
      mmsi_history: { v: '111111111', src: ['manual'] },
      call_sign: { v: ['A', 'B'], src: ['manual'] },
    });
    await updated(ask, id, {
      mmsi_history: { v: '111111111', src: [FIXTURE_DOCUMENT] },
      call_sign: { v: ['B', 'C'], src: [FIXTURE_DOCUMENT] },
    });
    return attrsNow(ask, id);
  });
  expect(attrs).toMatchObject({
    mmsi_history: { v: '111111111', src: ['manual', FIXTURE_DOCUMENT] },
    call_sign: { v: ['A', 'B', 'C'], src: ['manual', FIXTURE_DOCUMENT] },
  });
});

test('an update reads an old value that is one text or the text of a list, and adds each new value once', async () => {
  const attrs = await rolledBack('app', async (ask) => {
    const id = await created(ask, {
      mmsi_history: { v: '111111111', src: ['manual'] },
      call_sign: { v: '["A", "B"]', src: ['manual'] },
    });
    await updated(ask, id, {
      mmsi_history: { v: ['222222222', '222222222'], src: [FIXTURE_DOCUMENT] },
      call_sign: { v: ['A', 'C'], src: [FIXTURE_DOCUMENT] },
    });
    return attrsNow(ask, id);
  });
  expect(attrs).toMatchObject({
    mmsi_history: { v: ['111111111', '222222222'], src: ['manual', FIXTURE_DOCUMENT] },
    call_sign: { v: ['A', 'B', 'C'], src: ['manual', FIXTURE_DOCUMENT] },
  });
});

test('an update whose list holds each old value and an older one gives the order of the history', async () => {
  const attrs = await rolledBack('app', async (ask) => {
    const id = await created(ask, { mmsi_history: { v: '273278480', src: ['manual'] } });
    await updated(ask, id, {
      mmsi_history: { v: ['314975000', '273278480'], src: [FIXTURE_DOCUMENT] },
    });
    return attrsNow(ask, id);
  });
  expect(attrs).toMatchObject({
    mmsi_history: { v: ['314975000', '273278480'], src: ['manual', FIXTURE_DOCUMENT] },
  });
});
