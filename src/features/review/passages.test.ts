import { afterEach, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { passagesOf, readPassages } from './passages';

// The writer reads at most 1,000 acts in one request, and refuses a longer list.
const MOST_ACTS = 1000;

const idOf = (index: number): string =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

const asked = z.object({ proposalIds: z.array(z.string()) });

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a queue of more than 1,000 acts is read in parts, and every act gets its passage', async () => {
  const sizes: number[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((_address: string, init: { readonly body: string }): Promise<Response> => {
      const { proposalIds } = asked.parse(JSON.parse(init.body));
      sizes.push(proposalIds.length);
      if (proposalIds.length > MOST_ACTS)
        return Promise.resolve(
          Response.json({ refusal: 'the body names at most 1000 acts' }, { status: 422 }),
        );
      return Promise.resolve(
        Response.json({
          passages: proposalIds.map((proposalId) => ({
            proposalId,
            document: 'doc_0123456789ab',
            title: 'A register',
            page: 1,
            text: `the words of ${proposalId}`,
          })),
          disputes: proposalIds.slice(0, 1).map((proposalId) => ({ proposalId, reason: 'why' })),
        }),
      );
    }),
  );
  const ids = Array.from({ length: 2500 }, (_, index) => idOf(index));

  const read = await readPassages(ids);

  expect(sizes).toStrictEqual([1000, 1000, 500]);
  expect(passagesOf(read, idOf(2499))).toStrictEqual({
    state: 'held',
    passages: [
      {
        document: 'doc_0123456789ab',
        title: 'A register',
        page: 1,
        text: `the words of ${idOf(2499)}`,
      },
    ],
    dispute: null,
  });
  expect(passagesOf(read, idOf(2000))).toMatchObject({ dispute: 'why' });
});

test('a part that the writer does not give leaves every passage private', async () => {
  let calls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn((): Promise<Response> => {
      calls += 1;
      return Promise.resolve(
        calls === 2
          ? Response.json({ doubt: 'lost' }, { status: 502 })
          : Response.json({ passages: [], disputes: [] }),
      );
    }),
  );

  const read = await readPassages(Array.from({ length: 1500 }, (_, index) => idOf(index)));

  expect(read.state).toBe('private');
});
