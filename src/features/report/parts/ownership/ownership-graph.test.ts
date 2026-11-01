import { describe, expect, it } from 'vitest';
import figures from '../../data/publication-figures.json';
import nodes from '../../nodes-data';
import { figure12 } from './ownership-graph';

const ids = new Set(nodes.map((node) => node.node_id));
const entity = (id: string) => figure12.entities.find((one) => one.id === id);

describe('figure 12', () => {
  it('maps each entity and each link to a node of the report', () => {
    expect(figure12.entities.every((one) => ids.has(one.id))).toBe(true);
    expect(figure12.links.every((link) => ids.has(link.from) && ids.has(link.to))).toBe(true);
    expect(new Set(figure12.entities.map((one) => one.id)).size).toBe(figure12.entities.length);
  });

  it('keeps one link for each row with a named owner', () => {
    const named = figures.f12.filter((row) => !String(row[0]).startsWith('propriétaire non'));
    expect(figure12.links).toHaveLength(named.length);
  });

  it('puts an owner above what it owns in the same band', () => {
    // Rosimushchestvo owns Rosneftegaz, which owns Rosneft, which owns Rosnefteflot.
    const rows = ['N-O003', 'N-P026', 'N-O013'].map((id) => entity(id)?.depth);
    expect(rows).toEqual([0, 2, 3]);
    expect(entity('N-O024')?.band).toBe(1);
  });

  it('marks a proposed link and keeps the share as written', () => {
    const link = figure12.links.find((one) => one.from === 'N-O032' && one.to === 'N-O027');
    expect(link).toMatchObject({ proposed: true, share: '14.39% direct (2022)' });
    expect(entity('N-O062')?.holding).toBe('11 vessels');
  });
});
