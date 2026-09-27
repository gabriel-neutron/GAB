import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { sendVerdict } from './decision';

const ACT = 'aa000009-0000-4000-8000-000000000001';
const TARGET = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const asked: string[] = [];

const said = (body: unknown, status = 200): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn((address: string): Promise<Response> => {
      asked.push(address);
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }),
  );
};

beforeEach(() => {
  asked.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a promotion goes to the promote door, and only there', async () => {
  said({ proposalId: ACT, targetId: TARGET, state: 'decided' });

  expect(await sendVerdict(ACT, 'promoted')).toStrictEqual({
    step: 'decided',
    changeId: ACT,
    verdict: 'promoted',
  });
  expect(asked).toStrictEqual(['/write/promote-proposal']);
});

test('a rejection goes to the reject door, and only there', async () => {
  said({ proposalId: ACT, targetId: null, state: 'decided' });

  expect(await sendVerdict(ACT, 'rejected')).toStrictEqual({
    step: 'decided',
    changeId: ACT,
    verdict: 'rejected',
  });
  expect(asked).toStrictEqual(['/write/reject-proposal']);
});

test('a hold reaches no door', async () => {
  said({ proposalId: ACT, targetId: null, state: 'decided' });

  expect(await sendVerdict(ACT, 'deferred')).toStrictEqual({
    step: 'decided',
    changeId: ACT,
    verdict: 'deferred',
  });
  expect(asked).toStrictEqual([]);
});

test('a decision whose result is unknown is a doubt, and never a refusal', async () => {
  said({ doubt: 'the record gave no answer to read' }, 500);

  expect(await sendVerdict(ACT, 'promoted')).toStrictEqual({
    step: 'unknown',
    changeId: ACT,
    verdict: 'promoted',
    doubt: 'The write service did not confirm the decision, and the act may have run whole.',
  });
});

test('a decision the record refused carries the sentence of the writer', async () => {
  said({ refusal: 'the act is decided already, and a decided act is frozen' }, 409);

  expect(await sendVerdict(ACT, 'rejected')).toStrictEqual({
    step: 'refused',
    changeId: ACT,
    verdict: 'rejected',
    refusal: 'the act is decided already, and a decided act is frozen',
  });
});
