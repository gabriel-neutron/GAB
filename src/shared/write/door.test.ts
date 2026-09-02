// The one request that changes the record, with a stubbed fetch. It opens no socket: the
// address the door builds, and the outcome each answer becomes, are all here.

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { sendAct, sendDecision, type WriteOutcome } from './door';

const PROPOSAL = 'a3f1c8de-5b20-4a71-9c34-7e0d81f65b12';
const TARGET = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const asked: { address: string; method: string; body: string }[] = [];

const answers = (make: () => Promise<Response>): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn((address: string, init: RequestInit): Promise<Response> => {
      asked.push({
        address,
        method: typeof init.method === 'string' ? init.method : '',
        body: typeof init.body === 'string' ? init.body : '',
      });
      return make();
    }),
  );
};

const said = (body: unknown, status = 200): void => {
  answers(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
};

const outcomeOf = async (body: unknown, status = 200): Promise<WriteOutcome> => {
  said(body, status);
  return sendAct('update_attrs', { targetKind: 'entity', targetId: TARGET });
};

beforeEach(() => {
  asked.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('the act names the door, and the body carries the change and no act', async () => {
  said({ proposalId: PROPOSAL, targetId: TARGET, state: 'signed' });

  await sendAct('create_entity', { type: 'vessel', label: 'MV Northern Ledger' });

  expect(asked).toStrictEqual([
    {
      address: '/write/create-entity',
      method: 'POST',
      body: '{"type":"vessel","label":"MV Northern Ledger"}',
    },
  ]);
});

test('an answer that names a proposal and a target is signed', async () => {
  expect(
    await outcomeOf({ proposalId: PROPOSAL, targetId: TARGET, state: 'signed' }),
  ).toStrictEqual({ state: 'signed', proposalId: PROPOSAL, targetId: TARGET });
});

test('a refusal that names no proposal wrote nothing', async () => {
  expect(await outcomeOf({ refusal: 'the value of imo is not identifier' }, 422)).toStrictEqual({
    state: 'refused',
    refusal: 'the value of imo is not identifier',
  });
});

// The act is committed and it was not signed. The proposal identifier is the only way the
// operator finds the act again, so the outcome carries it and never drops it.
test('a refusal that names a proposal is undecided, and it keeps that name', async () => {
  expect(
    await outcomeOf({ refusal: 'the target no longer exists', proposalId: PROPOSAL }, 409),
  ).toStrictEqual({
    state: 'undecided',
    refusal: 'the target no longer exists',
    proposalId: PROPOSAL,
  });
});

test('a body that the writer did not write is unknown, and the sentence names the status', async () => {
  expect(await outcomeOf({ error: 'Bad Gateway' }, 502)).toStrictEqual({
    state: 'unknown',
    doubt: 'The write service answered 502, and this page cannot read the answer.',
  });
});

test('an answer that is not JSON at all is unknown, and the sentence names the status', async () => {
  answers(() => Promise.resolve(new Response('<html>Gateway Timeout</html>', { status: 504 })));

  expect(await sendAct('delete_entity', { targetId: TARGET })).toStrictEqual({
    state: 'unknown',
    doubt: 'The write service answered 504, and this page cannot read the answer.',
  });
});

test('a request that never arrived is unknown, and the sentence states the act may have run', async () => {
  answers(() => Promise.reject(new Error('the connection was dropped')));

  expect(await sendAct('delete_entity', { targetId: TARGET })).toStrictEqual({
    state: 'unknown',
    doubt: 'The write service did not answer, and the act may have reached it.',
  });
});

// ------------------------------------------------------------------------ the decision door --

test('a decision names its door, and the body carries the act that waits', async () => {
  said({ proposalId: PROPOSAL, targetId: null, state: 'decided' });

  await sendDecision('reject_proposal', PROPOSAL);

  expect(asked).toStrictEqual([
    {
      address: '/write/reject-proposal',
      method: 'POST',
      body: `{"proposalId":"${PROPOSAL}"}`,
    },
  ]);
});

test('a promotion that landed carries the row it made', async () => {
  said({ proposalId: PROPOSAL, targetId: TARGET, state: 'decided' });

  expect(await sendDecision('promote_proposal', PROPOSAL)).toStrictEqual({
    state: 'decided',
    proposalId: PROPOSAL,
    targetId: TARGET,
  });
});

// The record moved under the analyst. Nothing was written, and the sentence is the writer's.
test('a decision the record refused is a sentence, and it names no row', async () => {
  said({ refusal: 'the act is decided already, and a decided act is frozen' }, 409);

  expect(await sendDecision('promote_proposal', PROPOSAL)).toStrictEqual({
    state: 'refused',
    refusal: 'the act is decided already, and a decided act is frozen',
  });
});

// The writer reached the record and cannot say what landed. It names the act again, and the
// door must carry that doubt whole: a promotion that committed may never read as a refusal.
test('a decision whose answer names the act again is unknown, and never a refusal', async () => {
  said({ refusal: 'the record gave no answer to read', proposalId: PROPOSAL }, 409);

  expect(await sendDecision('promote_proposal', PROPOSAL)).toStrictEqual({
    state: 'unknown',
    doubt: 'The write service did not confirm the decision, and the act may have run whole.',
  });
});

test('a decision answered by a gateway is unknown, and the sentence names the status', async () => {
  said({ error: 'Bad Gateway' }, 502);

  expect(await sendDecision('reject_proposal', PROPOSAL)).toStrictEqual({
    state: 'unknown',
    doubt: 'The write service answered 502, and this page cannot read the answer.',
  });
});

test('a decision that never arrived is unknown, and the sentence states the act may have run', async () => {
  answers(() => Promise.reject(new Error('the connection was dropped')));

  expect(await sendDecision('promote_proposal', PROPOSAL)).toStrictEqual({
    state: 'unknown',
    doubt: 'The write service did not answer, and the act may have reached it.',
  });
});
