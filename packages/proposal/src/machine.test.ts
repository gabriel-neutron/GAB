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
  const act = ready(machineAct(CREATE, [DOC, OTHER], null));
  expect(act.src).toStrictEqual([DOC, OTHER]);
  expect(act.payload['sources']).toStrictEqual([DOC, OTHER]);
  expect(act.payload['attrs']).toStrictEqual({ imo: { v: '9123456', src: [DOC, OTHER] } });
});

test('a relation names its two ends and cites the documents', () => {
  const act = ready(
    machineAct(
      { op: 'create_relation', type: 'owns', srcId: ENTITY, dstId: OTHER_ENTITY },
      [DOC],
      null,
    ),
  );
  expect(act.names).toStrictEqual([ENTITY, OTHER_ENTITY]);
  expect(act.src).toStrictEqual([DOC]);
});

for (const word of ['manual', 'inherited'])
  test(`a cited document named ${word} is refused`, () => {
    expect(machineAct(CREATE, [DOC, word], null).ready).toBe(false);
  });

test('an act that cites no document is refused', () => {
  expect(machineAct(CREATE, [], null).ready).toBe(false);
});

test('an act that the request schema refuses is refused', () => {
  expect(machineAct({ op: 'create_entity', type: '', label: 'Nayara' }, [DOC], null).ready).toBe(
    false,
  );
});

test('an unknown op is refused', () => {
  expect(machineAct({ op: 'merge_entity' }, [DOC], null).ready).toBe(false);
});

test('a kept value drops a reserved word it held and keeps its documents', () => {
  const prior = { imo: { v: '9123456', src: ['manual', OTHER] } };
  const act = ready(
    machineAct(
      {
        op: 'update_attrs',
        targetKind: 'entity',
        targetId: ENTITY,
        attrs: { imo: { v: '9123456' } },
      },
      [DOC],
      prior,
    ),
  );
  expect(act.payload['attrs']).toStrictEqual({ imo: { v: '9123456', src: [OTHER, DOC] } });
  expect(act.src).toStrictEqual([OTHER, DOC]);
});

test('an update with a prior that does not parse is refused', () => {
  const draft = machineAct(
    { op: 'update_attrs', targetKind: 'entity', targetId: ENTITY, attrs: { imo: { v: '1' } } },
    [DOC],
    'not attributes',
  );
  expect(draft.ready).toBe(false);
});
