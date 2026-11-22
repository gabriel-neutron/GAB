import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dialog } from 'radix-ui';
import { describe, expect, it, vi } from 'vitest';
import { NodeRecord } from './node-panel';
import { owners } from './parts/ownership/owners-join';
import { reportGraph } from './report-graph';
import { ReportContext } from './use-report';

// The panel links with the router; a plain anchor that names its target is enough here.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { readonly to: string; readonly children: ReactNode }) => (
    <a data-to={to}>{children}</a>
  ),
}));

// The record sits in the dialog of the panel inside the report frame, which give the record its context.
const graphLink = (id: string) =>
  renderToStaticMarkup(
    <ReportContext value={{ openNode: () => undefined }}>
      <Dialog.Root open>
        <NodeRecord id={id} />
      </Dialog.Root>
    </ReportContext>,
  ).includes('data-to="/graph"');

describe('the node panel of the owners map', () => {
  it('links to the graph only when the node has a record id', () => {
    const ids = [...new Set(owners.flatMap((owner) => [owner.nodeId, owner.holderId]))];
    for (const id of ids) {
      const hasRecord = (reportGraph.node(id)?.record_entity_id ?? '') !== '';
      expect([id, graphLink(id)]).toEqual([id, hasRecord]);
    }
    // Both cases occur: Rosimushchestvo has no record id, Transneft has one.
    expect(graphLink('N-O003')).toBe(false);
    expect(graphLink('N-P034')).toBe(true);
  });
});

describe('the description of the node panel', () => {
  const description = (id: string) =>
    /<p id="[^"]*"[^>]*>([^<]*)<\/p>/.exec(
      renderToStaticMarkup(
        <ReportContext value={{ openNode: () => undefined }}>
          <Dialog.Root open>
            <NodeRecord id={id} />
          </Dialog.Root>
        </ReportContext>,
      ),
    )?.[1];

  it('leaves out an empty country and an empty score', () => {
    // VEB.RF has no country and no score in the data.
    const blank = reportGraph.node('N-O002');
    expect([blank?.country, blank?.evidence_score_0_11]).toEqual(['', '']);
    expect(description('N-O002')).toBe('');
  });
});

describe('the relations of the node panel', () => {
  it('ends no line of a relation with a separator', () => {
    // Nord Axis has relations with no document in the data.
    const html = renderToStaticMarkup(
      <ReportContext value={{ openNode: () => undefined }}>
        <Dialog.Root open>
          <NodeRecord id="N-O049" />
        </Dialog.Root>
      </ReportContext>,
    );
    expect(reportGraph.relations('N-O049').length).toBeGreaterThan(0);
    expect(html).not.toMatch(/ · <\/span>/);
  });
});
