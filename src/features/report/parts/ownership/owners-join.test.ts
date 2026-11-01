import { describe, expect, it } from 'vitest';
import { ownershipUi } from '../../content';
import { controllerRows, nodeSites, ownerFaults, owners, parseOwners } from './owners-join';

const HEAD = 'node_id,holder_id,relation,share_pct,controller,holding,documents,checked';
const faultsOf = (row: string) =>
  ownerFaults(parseOwners(`${HEAD}\n${row}`), controllerRows, nodeSites);

describe('the owners join', () => {
  it('gives each site and each holder a known node id, with documents', () => {
    expect(owners.length).toBeGreaterThan(0);
    expect(ownerFaults(owners, controllerRows, nodeSites)).toEqual([]);
  });

  it('has the words of each relation, controller and holding in the copy', () => {
    const { labels, relations } = ownershipUi.owners;
    for (const owner of owners) {
      expect(Object.keys(relations)).toContain(owner.relation);
      expect(Object.keys(labels)).toEqual(
        expect.arrayContaining([owner.controller, owner.holding]),
      );
    }
  });

  it('fails when a holder has no node id or an unknown one', () => {
    const good = 'N-P020,N-P034,owns,,Russian federal state,Transneft,doc_7dc0578dfb33,2026-11-01';
    expect(faultsOf(good)).toEqual([]);
    expect(faultsOf(good.replace('N-P034', ''))).toEqual(['row 1: unknown holder id ""']);
    expect(faultsOf(good.replace('N-P034', 'N-X999'))).toEqual([
      'row 1: unknown holder id "N-X999"',
    ]);
    expect(faultsOf(good.replace('N-P020', 'N-X998'))).toEqual(['row 1: unknown node id "N-X998"']);
  });

  it('fails on a site with no position, or a controller that the owners figure does not have', () => {
    // Transneft is a node with no position.
    expect(
      faultsOf('N-P034,N-P034,owns,,Russian federal state,Transneft,doc_7dc0578dfb33,2026-11-01'),
    ).toEqual(['row 1: no position']);
    expect(
      faultsOf('N-P020,N-P034,owns,,Private shareholders,Transneft,doc_7dc0578dfb33,2026-11-01'),
    ).toHaveLength(1);
  });
});
