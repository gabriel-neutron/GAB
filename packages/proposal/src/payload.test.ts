import { expect, test } from 'vitest';

import { proposalAct } from './payload.ts';

const TARGET = '0ea482d0-cd00-4c77-911e-419dd2d1779f';

test('an act on the name and the type carries only the column it changes', () => {
  expect(
    proposalAct({ op: 'update_entity', targetId: TARGET, type: 'vessel' }, null),
  ).toStrictEqual({
    ready: true,
    act: {
      op: 'update_entity',
      payload: { type: 'vessel' },
      src: ['manual'],
      names: [],
      targetKind: 'entity',
      targetId: TARGET,
    },
  });
});

test('an act on the name and the type carries both columns when it changes both', () => {
  const draft = proposalAct(
    { op: 'update_entity', targetId: TARGET, label: 'MV Northern Star', type: 'vessel' },
    null,
  );
  expect(draft).toMatchObject({
    ready: true,
    act: { payload: { label: 'MV Northern Star', type: 'vessel' } },
  });
});
