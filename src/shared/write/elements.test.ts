import { afterEach, expect, test, vi } from 'vitest';

import { writeElement } from './elements';

const PROPOSAL = 'a3f1c8de-5b20-4a71-9c34-7e0d81f65b12';
const TARGET = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const sent = (): { address: string; body: string }[] => {
  const asked: { address: string; body: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((address: string, init: RequestInit): Promise<Response> => {
      asked.push({ address, body: typeof init.body === 'string' ? init.body : '' });
      return Promise.resolve(
        new Response(JSON.stringify({ proposalId: PROPOSAL, targetId: TARGET, state: 'signed' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }),
  );
  return asked;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test('an attribute act sends its target and its attributes, and no act', async () => {
  const asked = sent();

  const outcome = await writeElement({
    op: 'update_attrs',
    targetKind: 'entity',
    targetId: TARGET,
    attrs: { imo: { v: '9321483' } },
  });

  expect(outcome).toStrictEqual({ step: 'done', proposalId: PROPOSAL, targetId: TARGET });
  expect(asked).toStrictEqual([
    {
      address: '/write/update-attrs',
      body: `{"targetKind":"entity","targetId":"${TARGET}","attrs":{"imo":{"v":"9321483"}}}`,
    },
  ]);
});

test('a name the act leaves as it stands is a key the body never carries', async () => {
  const asked = sent();

  await writeElement({ op: 'update_entity', targetId: TARGET, label: null, type: 'vessel' });

  expect(asked).toStrictEqual([
    { address: '/write/update-entity', body: `{"targetId":"${TARGET}","type":"vessel"}` },
  ]);
});

test('an open start of a relation is a key the body never carries', async () => {
  const asked = sent();
  const source = 'b4e2f7a0-1c36-4d58-8e9a-0f2b3c4d5e6f';

  await writeElement({
    op: 'create_relation',
    type: 'owned_by',
    srcId: source,
    dstId: TARGET,
    validFrom: null,
    validTo: '2019-06-30',
  });

  expect(asked).toStrictEqual([
    {
      address: '/write/create-relation',
      body: `{"type":"owned_by","srcId":"${source}","dstId":"${TARGET}","validTo":"2019-06-30"}`,
    },
  ]);
});
