// The requests that change the record, with a stubbed fetch. They open no socket: the address
// each door builds, and the outcome each answer becomes, are all here.

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { sendAct, sendDecision, uploadDocument, type Signed } from './door';
import type { WriteResult } from './write-state';

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

const outcomeOf = async (body: unknown, status = 200): Promise<WriteResult<Signed>> => {
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
  ).toStrictEqual({ step: 'done', proposalId: PROPOSAL, targetId: TARGET });
});

test('a refusal wrote nothing, and it carries the sentence of the writer', async () => {
  expect(await outcomeOf({ refusal: 'the value of imo is not identifier' }, 422)).toStrictEqual({
    step: 'refused',
    refusal: 'the value of imo is not identifier',
  });
});

test('a doubt is unknown, and never a refusal', async () => {
  expect(await outcomeOf({ doubt: 'the record gave no answer to read' }, 502)).toStrictEqual({
    step: 'unknown',
    doubt: 'The write service did not confirm the act, and the act may have run whole.',
  });
});

test('a body that the writer did not write is unknown, and the sentence names the status', async () => {
  expect(await outcomeOf({ error: 'Bad Gateway' }, 502)).toStrictEqual({
    step: 'unknown',
    doubt: 'The write service answered 502, and this page cannot read the answer.',
  });
});

test('an answer that is not JSON at all is unknown, and the sentence names the status', async () => {
  answers(() => Promise.resolve(new Response('<html>Gateway Timeout</html>', { status: 504 })));

  expect(await sendAct('delete_entity', { targetId: TARGET })).toStrictEqual({
    step: 'unknown',
    doubt: 'The write service answered 504, and this page cannot read the answer.',
  });
});

test('a request that never arrived is unknown, and the sentence states the act may have run', async () => {
  answers(() => Promise.reject(new Error('the connection was dropped')));

  expect(await sendAct('delete_entity', { targetId: TARGET })).toStrictEqual({
    step: 'unknown',
    doubt: 'The write service did not answer, and the act may have reached it.',
  });
});

// ------------------------------------------------------------------------ the decision door --

test('a decision names its door, and the body carries the unit, the reason and the note', async () => {
  said({ targetId: null, state: 'decided' });

  await sendDecision({ op: 'reject_unit', unitId: PROPOSAL, reason: 'other', note: 'a ferry' });
  await sendDecision({ op: 'reject_relation', proposalId: PROPOSAL, reason: 'duplicate' });

  expect(asked).toStrictEqual([
    {
      address: '/write/reject-unit',
      method: 'POST',
      body: `{"unitId":"${PROPOSAL}","reason":"other","note":"a ferry"}`,
    },
    {
      address: '/write/reject-relation',
      method: 'POST',
      body: `{"proposalId":"${PROPOSAL}","reason":"duplicate"}`,
    },
  ]);
});

test('a promotion that landed is done', async () => {
  said({ targetId: TARGET, state: 'decided' });

  expect(await sendDecision({ op: 'promote_unit', unitId: PROPOSAL })).toStrictEqual({
    step: 'done',
  });
});

// The record moved under the analyst. Nothing was written, and the sentence is the writer's.
test('a decision the record refused is a sentence, and it names no row', async () => {
  said({ refusal: 'the unit is decided already, and a decided act is frozen' }, 422);

  expect(await sendDecision({ op: 'promote_unit', unitId: PROPOSAL })).toStrictEqual({
    step: 'refused',
    refusal: 'the unit is decided already, and a decided act is frozen',
  });
});

test('a decision whose answer is a doubt is unknown, and never a refusal', async () => {
  said({ doubt: 'the record gave no answer to read' }, 502);

  expect(await sendDecision({ op: 'promote_unit', unitId: PROPOSAL })).toStrictEqual({
    step: 'unknown',
    doubt: 'The write service did not confirm the act, and the act may have run whole.',
  });
});

test('a decision answered by a gateway is unknown, and the sentence names the status', async () => {
  said({ error: 'Bad Gateway' }, 502);

  expect(
    await sendDecision({ op: 'reject_unit', unitId: PROPOSAL, reason: 'duplicate' }),
  ).toStrictEqual({
    step: 'unknown',
    doubt: 'The write service answered 502, and this page cannot read the answer.',
  });
});

const UPLOAD = {
  fileName: 'mgt-7.pdf',
  title: 'MGT-7',
  content: 'JVBERi0=',
  retrievedAt: '2026-10-01',
};

test('an upload goes to its own door, and each answer becomes its outcome', async () => {
  said({ state: 'stored', documentId: 'doc_4f1c2a9e7b30', emptyPages: [2] });
  expect(await uploadDocument(UPLOAD)).toStrictEqual({
    step: 'done',
    document: 'stored',
    documentId: 'doc_4f1c2a9e7b30',
    emptyPages: [2],
  });
  expect(asked.map((one) => one.address)).toStrictEqual(['/write/upload-document']);

  said({ state: 'known', documentId: 'doc_4f1c2a9e7b30', emptyPages: [] });
  expect(await uploadDocument(UPLOAD)).toStrictEqual({
    step: 'done',
    document: 'known',
    documentId: 'doc_4f1c2a9e7b30',
  });

  said({ refusal: 'retrievedAt is required' }, 422);
  expect(await uploadDocument(UPLOAD)).toStrictEqual({
    step: 'refused',
    refusal: 'retrievedAt is required',
  });
});

test('an upload the writer could not finish is unknown, and never refused', async () => {
  said({ refusal: 'the raw store or the database did not answer' }, 503);
  expect((await uploadDocument(UPLOAD)).step).toBe('unknown');

  answers(() => Promise.reject(new Error('the connection was dropped')));
  expect((await uploadDocument(UPLOAD)).step).toBe('unknown');
});

test('a decision that never arrived is unknown, and the sentence states the act may have run', async () => {
  answers(() => Promise.reject(new Error('the connection was dropped')));

  expect(await sendDecision({ op: 'promote_unit', unitId: PROPOSAL })).toStrictEqual({
    step: 'unknown',
    doubt: 'The write service did not answer, and the act may have reached it.',
  });
});
