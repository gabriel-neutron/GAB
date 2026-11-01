import { describe, expect, it } from 'vitest';
import { ownershipUi } from '../../content';
import { controllerRows, nodeSites, ownerFaults, owners, parseOwners } from './owners-join';

const HEAD =
  'node_id,holder_id,relation,share_pct,controller,holding,documents,checked,share_as_of,outside_figure';
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

  it('fails on a second row, a bad relation, a missing document or a missing date', () => {
    const good = 'N-P020,N-P034,owns,,Russian federal state,Transneft,doc_7dc0578dfb33,2026-11-01';
    expect(faultsOf(`${good}\n${good}`)).toEqual(['row 2: second row for N-P020']);
    expect(faultsOf(good.replace(',owns,', ',holds,'))).toEqual([
      'row 1: unknown relation "holds"',
    ]);
    expect(faultsOf(good.replace('doc_7dc0578dfb33', ''))).toEqual(['row 1: no document']);
    expect(faultsOf(good.replace('doc_7dc0578dfb33', 'doc_x'))).toEqual(['row 1: bad document id']);
    expect(faultsOf(good.replace('2026-11-01', ''))).toEqual(['row 1: no check date']);
  });

  it('fails on a site with no position, or a controller that the owners figure does not have', () => {
    // Transneft is a node with no position.
    expect(
      faultsOf('N-P034,N-P034,owns,,Russian federal state,Transneft,doc_7dc0578dfb33,2026-11-01'),
    ).toEqual(['row 1: no position']);
    expect(
      faultsOf('N-P020,N-P034,owns,,Private shareholders,Transneft,doc_7dc0578dfb33,2026-11-01'),
    ).toEqual([`row 1: "Private shareholders" / "Transneft" is not in the owners figure for Pay`]);
  });

  it('checks the pair in the layer of the site, unless the row says that the figure differs', () => {
    // KTRV is a Fight site; the owners figure has "Other holdings" only in Pay and Finance.
    const ktrv =
      'N-F032,N-O003,owns,100,Russian federal state,Other holdings,doc_655270eda8cd,2026-11-01';
    expect(faultsOf(`${ktrv},,`)).toEqual([
      'row 1: "Russian federal state" / "Other holdings" is not in the owners figure for Fight',
    ]);
    expect(faultsOf(`${ktrv},,yes`)).toEqual([]);
    const good = 'N-P020,N-P034,owns,,Russian federal state,Transneft,doc_7dc0578dfb33,2026-11-01';
    expect(faultsOf(`${good},,yes`)).toEqual([
      'row 1: "Russian federal state" / "Transneft" is in the owners figure for Pay',
    ]);
  });

  it('accepts a share date only with a share', () => {
    const good =
      'N-P020,N-P034,owns,60,Russian federal state,Transneft,doc_7dc0578dfb33,2026-11-01';
    expect(faultsOf(`${good},2020-09-07,`)).toEqual([]);
    expect(faultsOf(`${good.replace(',60,', ',,')},2020-09-07,`)).toEqual([
      'row 1: bad share date',
    ]);
    expect(faultsOf(`${good},2020,`)).toEqual(['row 1: bad share date']);
  });

  it('dates the share of Novatek in Arctic LNG 2 as the record does', () => {
    expect(owners.find((owner) => owner.nodeId === 'N-P018')?.shareAsOf).toBe('2020-09-07');
  });
});
