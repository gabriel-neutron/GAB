import { expect, test } from 'vitest';

import { machineAct, type MachineDraft } from './machine.ts';

const DOC = 'doc_0123456789ab';
const OTHER = 'doc_ba9876543210';
const ENTITY = '3f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b';
const OTHER_ENTITY = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const CREATE = {
  op: 'create_entity',
  type: 'vessel',
  label: 'Nayara',
  attrs: { imo: { v: '9123456' } },
};

const ready = (draft: MachineDraft) => {
  if (!draft.ready) throw new Error(`the act was refused: ${draft.refusal}`);
  return draft.act;
};

test('an act cites the documents the caller gives and never the operator document', () => {
  const act = ready(machineAct(CREATE, [DOC, OTHER]));
  expect(act.src).toStrictEqual([DOC, OTHER]);
  expect(act.payload['sources']).toStrictEqual([DOC, OTHER]);
  expect(act.payload['attrs']).toStrictEqual({ imo: { v: '9123456', src: [DOC, OTHER] } });
});

test('a relation names its two ends and cites the documents', () => {
  const act = ready(
    machineAct({ op: 'create_relation', type: 'owns', srcId: ENTITY, dstId: OTHER_ENTITY }, [DOC]),
  );
  expect(act.names).toStrictEqual([ENTITY, OTHER_ENTITY]);
  expect(act.src).toStrictEqual([DOC]);
});

test('an act that the request schema refuses is refused', () => {
  expect(machineAct({ op: 'create_entity', type: 'vessel' }, [DOC]).ready).toBe(false);
});

test('an unknown op is refused', () => {
  expect(machineAct({ op: 'merge_entity' }, [DOC]).ready).toBe(false);
});
