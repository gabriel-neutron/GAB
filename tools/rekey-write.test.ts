import { describe, expect, it } from 'vitest';

import { groupsOf, type Act } from './rekey-write.ts';

const cite = (excerpt: string | null) => ({ document: 'd', page: 1, excerpt, modality: 'asserts' });

const act = (id: string, change: Partial<Act> = {}): Act => ({
  id,
  op: 'create_entity',
  payload: { type: 'vessel', label: id, attrs: { dwt_t: { v: 9000 } } },
  targetId: null,
  names: [],
  originator: 'x',
  cites: [cite('Deadweight 9000 t')],
  ...change,
});

const link = (id: string, from: string, to: string, change: Partial<Act> = {}): Act =>
  act(id, {
    op: 'create_relation',
    payload: { type: 'owns', src_id: from, dst_id: to, src_kind: 'entity', dst_kind: 'entity' },
    names: [from, to],
    ...change,
  });

describe('groupsOf', () => {
  it('makes no group of an act with no drifted key', () => {
    expect(groupsOf([act('a', { payload: { attrs: { capacity_dwt: { v: 1 } } } })])).toEqual([]);
  });

  it('moves a relation with the entity that it names, and keeps the other entity as it is', () => {
    const company = act('b', { payload: { type: 'company', label: 'b' } });
    const [group] = groupsOf([act('a'), company, link('c', 'b', 'a')]);
    expect(group?.moved.map((one) => one.id)).toEqual(['a', 'c']);
    expect(group?.pass.map((one) => one.id)).toEqual(['b']);
    expect(group?.held).toBeNull();
  });

  it('joins two drifted entities that one relation names', () => {
    const groups = groupsOf([act('a'), act('b'), link('c', 'a', 'b')]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.moved).toHaveLength(3);
  });

  it('holds a group with an item that the plan holds or with a citation of an image', () => {
    expect(groupsOf([act('a', { cites: [cite('Tonnage 9000')] })])[0]?.held).not.toBeNull();
    expect(groupsOf([act('a', { cites: [cite(null)] })])[0]?.held).not.toBeNull();
  });

  it('holds a group with an entity that copies a duplicate identifier', () => {
    const copy = (id: string) =>
      act(id, {
        payload: {
          type: 'vessel',
          label: id,
          attrs: { dwt_t: { v: 9000 }, imo: { v: '9074729' } },
        },
      });
    expect(groupsOf([copy('a'), copy('b')]).map((one) => one.held)).not.toContain(null);
  });

  it('holds a group when an act outside it names a relation of the group', () => {
    const acts = [act('a'), link('c', 'a', 'z'), act('d', { op: 'create_relation', names: ['c'] })];
    expect(groupsOf(acts)[0]?.held).not.toBeNull();
  });
});
