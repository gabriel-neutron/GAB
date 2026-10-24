import { describe, expect, it } from 'vitest';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';
import type { Corpus, Proposal, Relation } from '@/shared/read/model';

import { chainView } from './chain-view';
import { project } from './projection';

// Two drawn entities of the committed corpus, joined by one promoted physical link and by one
// pending proposal of a physical link in the other direction.
const base = project(corpus, entityTypes);
const [from, to] = base.entities;
const [model] = corpus.proposals;
if (from === undefined || to === undefined || model === undefined)
  throw new Error('The committed corpus draws fewer than two entities or holds no proposal');

const promoted: Relation = {
  id: 'promoted-link',
  type: 'crude_flows_to',
  proposedType: null,
  srcKind: 'entity',
  srcId: from.id,
  dstKind: 'entity',
  dstId: to.id,
  attrs: {},
  sources: [],
  validFrom: null,
  validTo: null,
  promotedFrom: 'promoted-link',
};
const proposed: Proposal = {
  ...model,
  id: 'proposed-link',
  status: 'pending',
  payload: {
    kind: 'relation',
    type: 'products_flow_to',
    src_kind: 'entity',
    src_id: to.id,
    dst_kind: 'entity',
    dst_id: from.id,
    valid_from: null,
    valid_to: null,
    attrs: {},
  },
};
const read: Corpus = {
  ...corpus,
  relations: [...corpus.relations, promoted],
  proposals: [...corpus.proposals, proposed],
};
const view = chainView(read, project(read, entityTypes));
const styleOf = (id: string) =>
  view.arcs.features.find((one) => one.properties.id === id)?.properties.style;

describe('the chain on the map of the application', () => {
  it('draws a promoted physical link as a fact', () => {
    expect(styleOf('promoted-link')).not.toBe('in review');
  });

  it('draws a pending proposal of a physical link in review, and no step counts it', () => {
    expect(styleOf('proposed-link')).toBe('in review');
    expect(view.steps.flatMap((one) => one.arcs)).not.toContain('proposed-link');
    expect(view.steps.flatMap((one) => one.arcs)).toContain('promoted-link');
  });

  it('gives six steps', () => {
    expect(view.steps.map((one) => one.label)).toEqual([
      'Extraction',
      'Pipeline',
      'Refinery',
      'Terminal',
      'Export',
      'Exit',
    ]);
  });
});
