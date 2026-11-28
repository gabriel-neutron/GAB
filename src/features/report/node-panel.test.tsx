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

  it('leaves out an empty country and shows no evidence score', () => {
    // VEB.RF has no country in the data. The report defines no evidence score, so none shows.
    expect(reportGraph.node('N-O002')?.country).toBe('');
    expect(description('N-O002')).toBe('');
    expect(description('N-P001')).not.toMatch(/evidence|score|of 11/i);
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

describe('the origin of a document of the node panel', () => {
  const html = (id: string) =>
    renderToStaticMarkup(
      <ReportContext value={{ openNode: () => undefined }}>
        <Dialog.Root open>
          <NodeRecord id={id} />
        </Dialog.Root>
      </ReportContext>,
    );

  it('marks a document that a state body of a party to the conflict publishes', () => {
    // Novorossiysk cites a page of the war and sanctions portal of GUR for its third condition.
    expect(reportGraph.partyMark('doc_73f01151c6bf')).toBe('Party source (Ukraine)');
    expect(html('N-P005')).toContain('doc_73f01151c6bf · Party source (Ukraine)');
    expect(reportGraph.partyMarks('N-P005')).toBe('Party source (Ukraine)');
  });

  it('marks no other document', () => {
    expect(reportGraph.partyMark('doc_f4ae69f3ce3b')).toBe('');
    expect(html('N-P001')).not.toContain('Party source');
  });
});

describe('the addresses of the node documents', () => {
  it('give an address for each document that a node or a relation cites', async () => {
    const { default: nodes } = await import('./nodes-data');
    const { default: edges } = await import('./edges-data');
    const { default: file } = await import('./data/node-documents.json');
    const cited = [...nodes, ...edges].flatMap((row) => reportGraph.documents(row));
    // A new document of the node files needs tools/node-documents.ts.
    expect(cited.filter((doc) => !(doc in file.documents))).toEqual([]);
  });
});
