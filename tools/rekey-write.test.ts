import { describe, expect, it } from 'vitest';

import { evidenceFor, groupsOf, type Act } from './rekey-write.ts';

const cite = (excerpt: string | null) => ({ document: 'd', page: 1, excerpt, modality: 'asserts' });

const act = (id: string, change: Partial<Act> = {}): Act => ({
  id,
  op: 'create_entity',
  payload: { type: 'vessel', label: id, attrs: { dwt_t: { v: 9000 } } },
  targetId: null,
  names: [],
  originator: 'x',
  dissent: false,
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

  it('holds a group with an act that has no originator, and invents none', () => {
    expect(groupsOf([act('a', { originator: null })])[0]?.held).toBe('no originator');
    const company = act('b', { payload: { type: 'company', label: 'b' }, originator: null });
    expect(groupsOf([act('a'), company, link('c', 'b', 'a')])[0]?.held).toBe('no originator');
  });

  it('holds a group when an act outside it names a relation of the group', () => {
    const acts = [act('a'), link('c', 'a', 'z'), act('d', { op: 'create_relation', names: ['c'] })];
    expect(groupsOf(acts)[0]?.held).not.toBeNull();
  });
});

describe('groupsOf with a number sent as a text', () => {
  const year = (id: string, v: string, excerpt: string) =>
    act(id, {
      payload: { type: 'vessel', label: id, attrs: { build_year: { v } } },
      cites: [cite(excerpt)],
    });

  it('moves the act with the entities and relations that name it', () => {
    const [group] = groupsOf([year('a', '2003', 'Built 2003'), link('c', 'z', 'a')]);
    expect(group?.held).toBeNull();
    expect(group?.moved.map((one) => one.id)).toEqual(['a', 'c']);
    expect(group?.attrs.get('a')).toEqual({ build_year: { v: 2003 } });
  });

  it('holds the group when the text is no plain number', () => {
    expect(groupsOf([year('a', '2003 г.', 'Built 2003 г.')])[0]?.held).toBe(
      'the text of build_year is not a plain number',
    );
  });
});

describe('evidenceFor, at most 10 passages', () => {
  const many = (n: number, special: Record<number, string> = {}): Act =>
    act('a', {
      payload: { type: 'vessel', label: 'a', attrs: { dwt_t: { v: 9000 } } },
      cites: Array.from({ length: n }, (_, i) => cite(special[i] ?? `Passage ${String(i)}`)),
    });

  it('keeps every passage when there are 10 or fewer, and drops a repeated passage', () => {
    expect(evidenceFor(many(10), {}, [])).toHaveLength(10);
    const repeated = act('a', { cites: [cite('same'), cite('same'), cite('other')] });
    expect(evidenceFor(repeated, {}, [])?.map((one) => one.excerpt)).toEqual(['same', 'other']);
  });

  it('keeps the passages that carry the kept values, and fills with the first others', () => {
    const [group] = groupsOf([many(14, { 12: 'Deadweight 9000 t', 13: 'Wellington' })]);
    expect(group?.held).toBeNull();
    const kept = evidenceFor(
      many(14, { 12: 'Deadweight 9000 t', 13: 'Wellington' }),
      { capacity_dwt: { v: 9000 }, former_names: { v: ['Wellington'] } },
      [],
    );
    expect(kept).toHaveLength(10);
    expect(kept?.map((one) => one.excerpt)).toEqual(
      expect.arrayContaining(['Deadweight 9000 t', 'Wellington']),
    );
  });

  it('keeps the passage that the script found, and holds when the values need more than 10', () => {
    const found = [{ document: 'd', page: 1, excerpt: 'DWT (t)\n9000' }];
    expect(
      evidenceFor(many(14), { capacity_dwt: { v: 9000 } }, found)?.map((one) => one.excerpt),
    ).toContain('DWT (t)\n9000');
    const needing = Array.from({ length: 11 }, (_, i) => cite(`Name${String(i)}`));
    const attrs = { former_names: { v: needing.map((one) => one.excerpt ?? '') } };
    expect(evidenceFor(act('a', { cites: needing }), attrs, [])).toBeNull();
  });
});
